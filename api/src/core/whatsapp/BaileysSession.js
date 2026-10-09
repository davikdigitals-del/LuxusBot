import {
  makeWASocket,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { useMongoAuthState } from './mongoAuthState.js';
import WhatsAppSession from '../../models/WhatsAppSession.js';
import logger from '../../utils/logger.js';

// Pinned fallback in case fetchLatestBaileysVersion (a small network call WhatsApp
// hosts) is unreachable on a given deployment's network - connecting with a stale
// but valid version still works, it just may miss the newest protocol features.
const FALLBACK_WA_VERSION = [2, 3000, 1015901307];

const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

/**
 * One WhatsApp connection - a business's assistant number, or one agent's
 * personal linked number. Owns exactly one Baileys socket and persists its
 * auth state to Mongo (see mongoAuthState.js) so it survives process restarts.
 *
 * NOT exercised against a live WhatsApp connection in this codebase's own
 * test/dev environment (no network path to WhatsApp's servers there) -
 * verify with a real QR scan before depending on it in production.
 */
class BaileysSession {
  /**
   * @param {'business'|'agent'} ownerType
   * @param {string} ownerId
   * @param {import('events').EventEmitter} eventBus - see SessionRegistry
   */
  constructor(ownerType, ownerId, eventBus) {
    this.ownerType = ownerType;
    this.ownerId = String(ownerId);
    this.eventBus = eventBus;
    this.sock = null;
    this.auth = null;
    this.connecting = false;
    this.intentionalDisconnect = false;
  }

  get key() {
    return `${this.ownerType}:${this.ownerId}`;
  }

  async connect() {
    if (this.intentionalDisconnect || this.connecting || this.sock?.user) return;
    this.connecting = true;

    try {
      this.auth = await useMongoAuthState(this.ownerType, this.ownerId);
      await this.setStatus('connecting');

      let version;
      try {
        ({ version } = await fetchLatestBaileysVersion());
      } catch (error) {
        logger.warn(`Could not fetch latest WhatsApp version, using fallback: ${error.message}`);
        version = FALLBACK_WA_VERSION;
      }

      this.sock = makeWASocket({
        version,
        auth: {
          creds: this.auth.state.creds,
          keys: makeCacheableSignalKeyStore(this.auth.state.keys, baileysLogger),
        },
        logger: baileysLogger,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        syncFullHistory: false,
      });

      this.sock.ev.on('creds.update', this.auth.saveCreds);
      this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
      this.sock.ev.on('messages.upsert', (upsert) => {
        this.handleMessagesUpsert(upsert).catch((error) => {
          logger.error(`Failed to process WhatsApp messages for ${this.key}:`, error);
        });
      });
    } catch (error) {
      logger.error(`Error connecting ${this.key}:`, error);
      this.connecting = false;
      await this.setStatus('disconnected', { lastDisconnectReason: error.message });
      throw error;
    }
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      await this.setStatus('qr', { lastQR: qr, lastQRAt: new Date() });
      this.eventBus.emit('qr', { ownerType: this.ownerType, ownerId: this.ownerId, qr });
    }

    if (connection === 'open') {
      this.connecting = false;
      const phoneNumber = this.sock.user ? jidNormalizedUser(this.sock.user.id).split('@')[0] : null;
      await this.setStatus('connected', {
        phoneNumber,
        connectedAt: new Date(),
        lastQR: null,
        lastDisconnectReason: null,
      });
      logger.info(`WhatsApp connected: ${this.key} (${phoneNumber || 'unknown number'})`);
      this.eventBus.emit('connected', { ownerType: this.ownerType, ownerId: this.ownerId, phoneNumber });
    }

    if (connection === 'close') {
      this.connecting = false;
      this.sock = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      await this.setStatus('disconnected', {
        phoneNumber: null,
        lastDisconnectReason: lastDisconnect?.error?.message || 'unknown',
      });
      this.eventBus.emit('disconnected', { ownerType: this.ownerType, ownerId: this.ownerId, loggedOut });

      if (this.intentionalDisconnect) return;

      if (loggedOut) {
        logger.info(`WhatsApp logged out: ${this.key} - clearing stored session`);
        if (this.auth) await this.auth.clearState();
      } else {
        logger.warn(`WhatsApp connection closed for ${this.key}, reconnecting...`);
        setTimeout(() => this.connect().catch((e) => logger.error(`Reconnect failed for ${this.key}:`, e)), 2000);
      }
    }
  }

  async handleMessagesUpsert({ messages, type }) {
    if (type !== 'notify') return;

    const selfJid = this.selfJid;

    for (const msg of messages) {
      const remoteJid = msg.key?.remoteJid;
      if (!remoteJid || remoteJid.endsWith('@g.us')) continue;
      const senderJid = msg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')
        ? msg.key.remoteJidAlt
        : remoteJid;

      const content = normalizeMessageContent(msg.message);
      let text = content?.conversation || content?.extendedTextMessage?.text || '';
      let messageType = 'text';
      let media = null;

      if (content?.imageMessage) {
        messageType = 'image';
        media = { caption: content.imageMessage.caption || '' };
        text = text || content.imageMessage.caption || '[Image]';
      } else if (content?.videoMessage || content?.ptvMessage) {
        const video = content.videoMessage || content.ptvMessage;
        messageType = 'video';
        media = { caption: video.caption || '' };
        text = text || video.caption || '[Video]';
      } else if (content?.documentMessage) {
        messageType = 'document';
        media = { filename: content.documentMessage.fileName || 'document' };
        text = text || `[Document: ${media.filename}]`;
      } else if (content?.audioMessage) {
        messageType = content.audioMessage.ptt ? 'ptt' : 'audio';
        media = { mimetype: content.audioMessage.mimetype || '' };
        text = text || (content.audioMessage.ptt ? '[Voice message]' : '[Audio message]');
      } else if (content?.stickerMessage) {
        messageType = 'sticker';
        text = text || '[Sticker]';
      } else if (content?.locationMessage || content?.liveLocationMessage) {
        const location = content.locationMessage || content.liveLocationMessage;
        messageType = 'location';
        text = text || `[Location: ${location.name || 'Shared location'}${location.degreesLatitude != null && location.degreesLongitude != null
          ? ` (${location.degreesLatitude}, ${location.degreesLongitude})`
          : ''}]`;
      } else if (content?.contactMessage || content?.contactsArrayMessage) {
        messageType = 'contact';
        text = text || '[Contact shared]';
      } else if (content?.reactionMessage) {
        messageType = 'reaction';
        text = text || `[Reaction: ${content.reactionMessage.text || 'sent'}]`;
      } else if (content?.conversation || content?.extendedTextMessage) {
        messageType = 'text';
      } else {
        const contentType = Object.keys(content || {})[0] || 'unknown';
        messageType = 'other';
        text = `[${contentType === 'unknown' ? 'WhatsApp message' : contentType.replace(/Message$/, '')}]`;
      }

      logger.info(`Received WhatsApp message for ${this.key}`, {
        messageType,
      });
      const isSelfChat = !!selfJid && remoteJid === selfJid;
      const shouldTrackActivity = this.ownerType === 'business'
        ? !msg.key.fromMe
        : msg.key.fromMe && isSelfChat;
      if (shouldTrackActivity) {
        try {
          await WhatsAppSession.updateOne(
            { ownerType: this.ownerType, ownerId: this.ownerId },
            { $set: { lastInboundAt: new Date(), lastInboundType: messageType } }
          );
        } catch (error) {
          logger.error(`Could not record inbound WhatsApp activity for ${this.key}:`, error);
        }
      }
      this.eventBus.emit('message', {
        ownerType: this.ownerType,
        ownerId: this.ownerId,
        fromMe: !!msg.key.fromMe,
        // For agent sessions specifically: true only for their own "Message
        // Yourself" thread, never any other chat on their personal number -
        // that's what lets HandoffService safely treat it as a reply-to-customer
        // without ever touching the agent's normal personal messages.
        isSelfChat,
        remoteJid,
        messageKey: msg.key,
        from: senderJid.split('@')[0],
        text,
        type: messageType,
        media,
        pushName: msg.pushName || '',
        timestamp: msg.messageTimestamp,
      });
    }
  }

  /** Show "typing..." (state 'composing') or stop it ('paused') in a chat. Never throws. */
  async sendPresence(jid, state) {
    try {
      if (!this.sock) return;
      if (state === 'composing') await this.sock.presenceSubscribe(jid);
      await this.sock.sendPresenceUpdate(state, jid);
    } catch (error) {
      logger.debug(`Presence update failed for ${this.key}: ${error.message}`);
    }
  }

  /** Mark a received message as read (blue ticks), like a person opening the chat. Never throws. */
  async markRead(messageKey) {
    try {
      if (this.sock && messageKey) await this.sock.readMessages([messageKey]);
    } catch (error) {
      logger.debug(`Mark-read failed for ${this.key}: ${error.message}`);
    }
  }

  async sendMessage(jid, text) {
    if (!this.sock) throw new Error(`No active socket for ${this.key}`);
    return this.sock.sendMessage(jid, { text });
  }

  /** JID to send to for this session's own "Message Yourself" thread. */
  get selfJid() {
    if (!this.sock?.user) return null;
    return jidNormalizedUser(this.sock.user.id);
  }

  /**
   * Explicit, user-initiated unlink: invalidates the session with WhatsApp
   * and wipes stored credentials. The next connect() will require a fresh
   * QR scan. Use for an "unlink my WhatsApp" action, never on server shutdown.
   */
  async disconnect() {
    this.intentionalDisconnect = true;
    try {
      if (this.sock) {
        const socket = this.sock;
        this.sock = null;
        let timeout;
        try {
          await Promise.race([
            socket.logout(),
            new Promise((resolve) => {
              timeout = setTimeout(resolve, 5000);
            }),
          ]);
        } catch (error) {
          logger.warn(`WhatsApp logout failed for ${this.key}: ${error.message}`);
        } finally {
          clearTimeout(timeout);
          socket.end(undefined);
        }
      }
    } finally {
      if (this.auth) await this.auth.clearState();
      await this.setStatus('disconnected', { lastQR: null });
    }
  }

  /**
   * Soft close for process shutdown/restart: closes the socket but keeps
   * the stored credentials, so resumeAll() can reconnect without a QR scan.
   */
  async close() {
    if (this.auth) await this.auth.flush().catch(() => {});
    if (this.sock) {
      this.sock.ev.removeAllListeners();
      this.sock.end(undefined);
    }
  }

  async setStatus(status, extra = {}) {
    await WhatsAppSession.updateOne(
      { ownerType: this.ownerType, ownerId: this.ownerId },
      { $set: { status, ...extra } },
      { upsert: true }
    );
  }
}

export default BaileysSession;
export { BaileysSession };
