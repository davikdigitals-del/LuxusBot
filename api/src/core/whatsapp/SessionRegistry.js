import { EventEmitter } from 'events';
import BaileysSession from './BaileysSession.js';
import WhatsAppSession from '../../models/WhatsAppSession.js';
import logger from '../../utils/logger.js';

/**
 * Registry of live WhatsApp connections, one per (ownerType, ownerId) -
 * a business's assistant number, or one agent's personal linked number.
 *
 * Emits on `.events` (a shared EventEmitter):
 *   'message'     { ownerType, ownerId, fromMe, remoteJid, from, text, pushName }
 *   'qr'          { ownerType, ownerId, qr }              - QR string, render as an image client-side
 *   'connected'   { ownerType, ownerId, phoneNumber }
 *   'disconnected'{ ownerType, ownerId, loggedOut }
 *
 * MessageHandler subscribes to 'message' for business sessions (customer
 * traffic); HandoffService subscribes to it for agent sessions (agent
 * replies typed into their own "Message Yourself" thread).
 */
class SessionRegistry {
  constructor() {
    this.sessions = new Map(); // key -> BaileysSession
    this.events = new EventEmitter();
    this.events.setMaxListeners(50);
    // Texts we ourselves just posted into an agent's self-chat, so they aren't mistaken for the agent's replies
    this.ownSelfMessages = new Map();
  }

  key(ownerType, ownerId) {
    return `${ownerType}:${String(ownerId)}`;
  }

  /**
   * Start connecting (or reconnecting) a session. Returns immediately -
   * the QR code (if a fresh login is needed) arrives asynchronously via
   * the 'qr' event and is also persisted to WhatsAppSession.lastQR, so
   * callers can either subscribe to events or poll getStatus().
   */
  async connect(ownerType, ownerId) {
    const k = this.key(ownerType, ownerId);
    let session = this.sessions.get(k);

    if (!session) {
      session = new BaileysSession(ownerType, ownerId, this.events);
      this.sessions.set(k, session);
    }

    if (!session.connecting) {
      session.connect().catch((error) => logger.error(`SessionRegistry connect failed for ${k}:`, error));
    }

    return this.getStatus(ownerType, ownerId);
  }

  async refreshQr(ownerType, ownerId) {
    const status = await this.getStatus(ownerType, ownerId);
    if (status.status !== 'qr') {
      throw new Error('A QR code can only be refreshed while waiting to scan it');
    }

    const k = this.key(ownerType, ownerId);
    const session = this.sessions.get(k);
    if (session) {
      await session.disconnect();
      this.sessions.delete(k);
    } else {
      await WhatsAppSession.deleteOne({ ownerType, ownerId: String(ownerId) });
    }

    return this.connect(ownerType, ownerId);
  }

  /**
   * Reads from Mongo (not just the in-memory map) so it's correct even for
   * a session this process hasn't loaded yet - e.g. right after a restart,
   * before resumeAll() has reconnected everything.
   */
  async getStatus(ownerType, ownerId) {
    const doc = await WhatsAppSession.findOne({ ownerType, ownerId: String(ownerId) });
    if (!doc) {
      return { status: 'disconnected', phoneNumber: null, qr: null };
    }
    return {
      status: doc.status,
      phoneNumber: doc.status === 'connected' ? doc.phoneNumber : null,
      qr: doc.status === 'qr' ? doc.lastQR : null,
      connectedAt: doc.connectedAt,
    };
  }

  async sendMessage(ownerType, ownerId, jid, text) {
    const session = this.sessions.get(this.key(ownerType, ownerId));
    if (!session) {
      throw new Error(`No active WhatsApp session for ${ownerType}:${ownerId}`);
    }
    return session.sendMessage(jid, text);
  }

  async sendPresence(ownerType, ownerId, jid, state) {
    const session = this.sessions.get(this.key(ownerType, ownerId));
    if (session) await session.sendPresence(jid, state);
  }

  async markRead(ownerType, ownerId, messageKey) {
    const session = this.sessions.get(this.key(ownerType, ownerId));
    if (session) await session.markRead(messageKey);
  }

  /** Send to the session's own number's "Message Yourself" thread. */
  async sendSelfMessage(ownerType, ownerId, text) {
    const session = this.sessions.get(this.key(ownerType, ownerId));
    if (!session || !session.selfJid) {
      throw new Error(`No connected WhatsApp session for ${ownerType}:${ownerId}`);
    }
    const k = `${String(ownerId)}|${text}`;
    this.ownSelfMessages.set(k, Date.now() + 60_000);
    for (const [key, expires] of this.ownSelfMessages) if (expires < Date.now()) this.ownSelfMessages.delete(key);
    return session.sendMessage(session.selfJid, text);
  }

  /** True (once) if this self-chat text is one we posted ourselves - callers must ignore it. */
  consumeOwnSelfMessage(ownerId, text) {
    const k = `${String(ownerId)}|${text}`;
    const expires = this.ownSelfMessages.get(k);
    if (!expires) return false;
    this.ownSelfMessages.delete(k);
    return expires >= Date.now();
  }

  isConnected(ownerType, ownerId) {
    return this.sessions.get(this.key(ownerType, ownerId))?.sock?.user != null;
  }

  async disconnect(ownerType, ownerId) {
    const k = this.key(ownerType, ownerId);
    const session = this.sessions.get(k);
    if (session) {
      await session.disconnect();
      this.sessions.delete(k);
    } else {
      // Not loaded in this process - still clear the persisted record
      await WhatsAppSession.deleteOne({ ownerType, ownerId: String(ownerId) });
    }
  }

  /**
   * Reconnect every previously-connected session on process startup, so a
   * server restart doesn't force every business/agent to re-scan a QR.
   */
  async resumeAll() {
    const docs = await WhatsAppSession.find({ status: { $in: ['connected', 'connecting', 'qr'] } });
    logger.info(`Resuming ${docs.length} WhatsApp session(s)...`);
    for (const doc of docs) {
      await this.connect(doc.ownerType, doc.ownerId).catch((error) =>
        logger.error(`Failed to resume session ${doc.ownerType}:${doc.ownerId}:`, error)
      );
    }
  }

  /**
   * Process shutdown: closes sockets without invalidating sessions, so
   * resumeAll() reconnects them cleanly on next boot. NOT the same as
   * calling disconnect() on every session (that's a hard, user-initiated
   * unlink and would force a QR re-scan for every business and agent).
   */
  async closeAll() {
    for (const [, session] of this.sessions) {
      await session.close().catch(() => {});
    }
    this.sessions.clear();
  }
}

export default new SessionRegistry();
export { SessionRegistry };
