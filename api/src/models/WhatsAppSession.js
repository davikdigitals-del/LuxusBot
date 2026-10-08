import mongoose from 'mongoose';

/**
 * One WhatsApp connection - either a business's assistant number or a
 * single agent's personal linked number.
 *
 * `data` is a direct Mongo port of Baileys' own useMultiFileAuthState
 * (see https://github.com/WhiskeySockets/Baileys - Utils/use-multi-file-auth-state.ts):
 * that helper stores one JSON file per credential/key ("creds.json",
 * "app-state-sync-key-<id>.json", ...); here each of those "files" is one
 * entry in this Map instead, serialized with Baileys' own BufferJSON so
 * Buffers/Uint8Arrays round-trip correctly. See core/whatsapp/mongoAuthState.js.
 */
const whatsappSessionSchema = new mongoose.Schema({
  ownerType: {
    type: String,
    enum: ['business', 'agent'],
    required: true,
  },
  // Business._id for a business session, User._id for an agent session
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  data: {
    type: Map,
    of: String,
    default: {},
  },
  status: {
    type: String,
    enum: ['disconnected', 'connecting', 'qr', 'connected'],
    default: 'disconnected',
  },
  // The WhatsApp number this session ended up authenticated as, once connected
  phoneNumber: {
    type: String,
    default: null,
  },
  lastQR: {
    type: String,
    default: null,
  },
  lastQRAt: Date,
  connectedAt: Date,
  lastDisconnectReason: String,
}, {
  timestamps: true,
});

whatsappSessionSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsappSessionSchema);

export default WhatsAppSession;
