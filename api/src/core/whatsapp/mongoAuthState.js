import { WAProto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import WhatsAppSession from '../../models/WhatsAppSession.js';
import logger from '../../utils/logger.js';

/**
 * MongoDB port of Baileys' own useMultiFileAuthState (their file-per-key
 * approach kept verbatim, just against one Mongo document's `data` Map
 * instead of files on disk). Baileys' own docs recommend exactly this for
 * anything beyond a single local bot: "would recommend writing an auth
 * state for use with a proper SQL or No-SQL DB."
 *
 * This has NOT been exercised against a live WhatsApp connection (no
 * network path to WhatsApp's servers from the environment this was
 * written in) - the serialization round-trip is unit tested, but connect
 * a real device once before relying on it in production.
 */
export const useMongoAuthState = async (ownerType, ownerId) => {
  let doc = await WhatsAppSession.findOne({ ownerType, ownerId });
  if (!doc) {
    doc = new WhatsAppSession({ ownerType, ownerId, data: new Map() });
    await doc.save();
  }

  const readData = (key) => {
    const raw = doc.data.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw, BufferJSON.reviver);
    } catch (error) {
      logger.error(`Corrupt WhatsApp auth entry ${key} for ${ownerType}:${ownerId}:`, error.message);
      return null;
    }
  };

  const writeData = (key, value) => {
    doc.data.set(key, JSON.stringify(value, BufferJSON.replacer));
  };

  const removeData = (key) => {
    doc.data.delete(key);
  };

  // Debounced persistence: Baileys can fire creds.update / keys.set rapidly
  // (every message touches signal sessions); coalesce writes so we don't
  // hit Mongo on every single one.
  let pendingSave = null;
  let saveRequested = false;
  let saveQueue = Promise.resolve();
  const persist = () => {
    const saving = saveQueue.catch(() => {}).then(() => doc.save());
    saveQueue = saving.catch(() => {});
    return saving;
  };
  const scheduleSave = () => {
    saveRequested = true;
    if (pendingSave) return pendingSave;

    pendingSave = new Promise((resolve) => setTimeout(resolve, 250))
      .then(async () => {
        while (saveRequested) {
          saveRequested = false;
          await persist();
        }
      })
      .finally(() => {
        pendingSave = null;
        if (saveRequested) scheduleSave();
      });

    return pendingSave;
  };

  const creds = readData('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = WAProto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                writeData(key, value);
              } else {
                removeData(key);
              }
            }
          }
          await scheduleSave();
        },
      },
    },
    saveCreds: async () => {
      writeData('creds', creds);
      await scheduleSave();
    },
    /** Force-flush pending writes (call before process exit / disconnect). */
    flush: async () => {
      if (pendingSave) await pendingSave;
      else await persist();
    },
    /** Wipe this session's auth material - used on logout so a stale session can't reconnect. */
    clearState: async () => {
      if (pendingSave) await pendingSave;
      doc.data = new Map();
      doc.phoneNumber = null;
      await scheduleSave();
    },
    /** The underlying WhatsAppSession document, for status/phoneNumber bookkeeping. */
    sessionDoc: doc,
  };
};

export default useMongoAuthState;
