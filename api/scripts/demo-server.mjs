/**
 * Runs the REAL Express app (src/app.js) and the REAL Mongoose models/routes,
 * with just the database layer swapped for an in-memory store - the same
 * technique used in tests/*.test.js. Seeds a realistic demo business so the
 * dashboard has something to show. NOT for production use; for local demos
 * and screenshots only, when a real MongoDB isn't available.
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';

process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.LOG_LEVEL = 'error';
process.env.PORT = process.env.PORT || '3000';

const mongoose = (await import('mongoose')).default;
const { User, Business, Contact, Conversation, KnowledgeBase, WhatsAppSession } = await import('../src/models/index.js');
const { createApp, attachErrorHandlers } = await import('../src/app.js');
const sessionRegistry = (await import('../src/core/whatsapp/SessionRegistry.js')).default;

const oid = () => new mongoose.Types.ObjectId();
const db = { users: new Map(), businesses: new Map(), contacts: new Map(), conversations: new Map(), kb: new Map(), sessions: new Map() };

// ---- Mongoose statics -> in-memory store (mirrors tests/*.test.js) ----
User.prototype.save = async function () { db.users.set(String(this._id), this); return this; };
User.findById = (id) => {
  const u = db.users.get(String(id)) || null;
  const q = Promise.resolve(u);
  q.select = async () => u;
  return q;
};
User.findByEmail = async (email) => [...db.users.values()].find((u) => u.email === String(email).toLowerCase()) || null;
User.find = async (q) => {
  const bizId = q['memberships.businessId'];
  return [...db.users.values()].filter((u) => u.memberships.some((m) => String(m.businessId) === String(bizId)));
};
User.countDocuments = async (q) => (await User.find(q)).length;

Business.prototype.save = async function () { db.businesses.set(String(this._id), this); return this; };
Business.findById = (id) => {
  const b = db.businesses.get(String(id)) || null;
  const q = Promise.resolve(b);
  q.select = async () => b;
  return q;
};
Business.findOne = (query) => {
  const q = Promise.resolve([...db.businesses.values()].find((b) => (!query._id || String(b._id) === String(query._id)) && (!query.status || b.status === query.status)) || null);
  q.select = async () => q;
  return q;
};

Contact.prototype.save = async function () { db.contacts.set(String(this._id), this); return this; };
Contact.findById = async (id) => db.contacts.get(String(id)) || null;
Contact.find = async (q) => [...db.contacts.values()].filter((c) => q._id.$in.some((id) => String(id) === String(c._id)));
Contact.countDocuments = async () => db.contacts.size;

Conversation.prototype.save = async function () { db.conversations.set(String(this._id), this); return this; };
Conversation.find = (query = {}) => {
  const list = [...db.conversations.values()].filter((c) =>
    (!query.businessId || String(c.businessId) === String(query.businessId)) &&
    (!query.status || c.status === query.status) &&
    (!query.handoffMode || c.handoffMode === query.handoffMode)
  ).sort((a, b) => b.updatedAt - a.updatedAt);
  const chain = { select: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, then: (res) => res(list) };
  return chain;
};
Conversation.findOne = async (query) => {
  if (query._id) return [...db.conversations.values()].find((c) => String(c._id) === String(query._id) && (!query.businessId || String(c.businessId) === String(query.businessId))) || null;
  return [...db.conversations.values()].find((c) => c.sessionId === query.sessionId) || null;
};
Conversation.countDocuments = async (q) => {
  let list = [...db.conversations.values()].filter((c) => String(c.businessId) === String(q.businessId));
  if (q.startedAt?.$gte) list = list.filter((c) => c.startedAt >= q.startedAt.$gte);
  if (q.handoffMode) list = list.filter((c) => c.handoffMode === q.handoffMode);
  if (q.status?.$ne) list = list.filter((c) => c.status !== q.status.$ne);
  return list.length;
};

KnowledgeBase.prototype.save = async function () { db.kb.set(String(this._id), this); return this; };
KnowledgeBase.find = (query = {}) => {
  const list = [...db.kb.values()].filter((d) => (!query.businessId || String(d.businessId) === String(query.businessId)) && (!query.status || d.status === query.status));
  const chain = { sort: () => chain, limit: () => chain, then: (res) => res(list) };
  return chain;
};
KnowledgeBase.findOne = async (q) => [...db.kb.values()].find((d) => String(d._id) === String(q._id) && String(d.businessId) === String(q.businessId)) || null;
KnowledgeBase.countDocuments = async (q) => [...db.kb.values()].filter((d) => String(d.businessId) === String(q.businessId) && (!q.status || d.status === q.status)).length;
KnowledgeBase.distinct = async (field, q) => [...new Set([...db.kb.values()].filter((d) => String(d.businessId) === String(q.businessId)).map((d) => d[field]))];

WhatsAppSession.findOne = async ({ ownerType, ownerId }) => db.sessions.get(`${ownerType}:${ownerId}`) || null;

// ---- Seed data ----
const ownerId = oid();
const agentId = oid();
const viewerId = oid();
const businessId = oid();

// Bypassing the real save() means the schema's pre('save') bcrypt hook never
// runs - hash the password ourselves before constructing each seeded user.
const demoPasswordHash = await bcrypt.hash('DemoPass123!', 10);

const owner = new User({
  _id: ownerId, email: 'owner@acmeretail.test', password: demoPasswordHash,
  firstName: 'Amara', lastName: 'Okafor', status: 'active', emailVerified: true,
  memberships: [{ businessId, role: 'owner', status: 'active', joinedAt: new Date('2026-06-01') }],
});
await owner.save();

const agent = new User({
  _id: agentId, email: 'agent@acmeretail.test', password: demoPasswordHash,
  firstName: 'Tunde', lastName: 'Bello', status: 'active', emailVerified: true,
  memberships: [{ businessId, role: 'agent', status: 'active', joinedAt: new Date('2026-07-12') }],
});
await agent.save();

const viewer = new User({
  _id: viewerId, email: 'viewer@acmeretail.test', password: 'DemoPass123!',
  firstName: 'Chinelo', lastName: 'Eze', status: 'active', emailVerified: true,
  memberships: [{ businessId, role: 'viewer', status: 'pending', invitedAt: new Date('2026-09-20') }],
});
await viewer.save();

const business = new Business({
  _id: businessId, name: 'Acme Retail', slug: 'acme-retail', owner: ownerId,
  status: 'active', primaryColor: '#B8923F',
  subscription: { plan: 'professional', status: 'active' },
  usage: { messagesThisMonth: 2140 },
  limits: { messagesPerMonth: 10000, maxTeamMembers: 10 },
  contact: { email: 'support@acmeretail.test', phone: '+234 801 234 5678', website: 'acmeretail.test', industry: 'Retail & E-commerce', description: 'Home goods and furniture, three showrooms across Lagos.' },
  assistant: { name: 'Ada', personality: 'warm, concise, a little playful', systemPrompt: 'Always mention our 30-day return policy when relevant.' },
  businessHours: { enabled: true, timezone: 'Africa/Lagos', schedule: {
    monday: { start: '09:00', end: '18:00', enabled: true }, tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true }, thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true }, saturday: { start: '10:00', end: '15:00', enabled: true },
    sunday: { start: '09:00', end: '18:00', enabled: false },
  }},
  aiConfig: { provider: 'anthropic', anthropicKeySet: true, temperature: 0.7, maxTokens: 1000 },
  apiKeys: [{ _id: oid(), name: 'Order sync', prefix: 'lx_live_9f8a2c1d', keyHash: 'x', permissions: ['messages:read', 'conversations:read'], enabled: true, createdAt: new Date('2026-08-01'), lastUsed: new Date('2026-09-24') }],
});
await business.save();

db.sessions.set(`business:${businessId}`, { ownerType: 'business', ownerId: String(businessId), status: 'connected', phoneNumber: '2348012345678', connectedAt: new Date('2026-06-02') });
db.sessions.set(`agent:${agentId}`, { ownerType: 'agent', ownerId: String(agentId), status: 'connected', phoneNumber: '2348099998888', connectedAt: new Date('2026-07-15') });

const contacts = [
  { name: 'Ifeoma Nwosu', phoneNumber: '2348023334444' },
  { name: 'David Umeh', phoneNumber: '2348045556666' },
  { name: 'Grace Adebayo', phoneNumber: '2348067778888' },
].map((c) => {
  const contact = new Contact({ _id: oid(), businessId, ...c, status: 'active', firstSeen: new Date('2026-08-01'), lastSeen: new Date() });
  db.contacts.set(String(contact._id), contact);
  return contact;
});

const makeConversation = ({ contact, status, handoffMode, intent, messages, assignedAgent, transferNote, minutesAgo }) => {
  const c = new Conversation({
    _id: oid(), businessId, userId: contact._id, phoneNumber: contact.phoneNumber,
    sessionId: crypto.randomUUID(), status, handoffMode, assignedAgent: assignedAgent || null,
    transferNote: transferNote || '', transferredAt: assignedAgent ? new Date() : undefined,
    context: { intent }, messages, startedAt: new Date(Date.now() - (minutesAgo + 20) * 60000),
  });
  c.updatedAt = new Date(Date.now() - minutesAgo * 60000);
  c.addMessage = function (role, content, messageType, metadata) { this.messages.push({ role, content, messageType, metadata, timestamp: new Date() }); };
  db.conversations.set(String(c._id), c);
  return c;
};

makeConversation({
  contact: contacts[0], status: 'escalated', handoffMode: 'human', intent: 'complaint', assignedAgent: agentId,
  transferNote: 'Damaged item on delivery, customer is upset - please prioritize.', minutesAgo: 4,
  messages: [
    { role: 'user', content: 'The dining table I ordered arrived with a cracked leg. This is unacceptable for what I paid.', timestamp: new Date(Date.now() - 24 * 60000) },
    { role: 'assistant', content: "I'm really sorry to hear that, Ifeoma. I can see your order #AR-10432 - let me get a team member to sort this out right away.", timestamp: new Date(Date.now() - 22 * 60000) },
    { role: 'assistant', content: 'Hi Ifeoma, this is Tunde - I can see the damage report. We\'ll send a replacement leg out today at no cost, or a full replacement if you\'d prefer. Which would you like?', metadata: { sentBy: 'agent', agentId: String(agentId) }, timestamp: new Date(Date.now() - 4 * 60000) },
  ],
});

makeConversation({
  contact: contacts[1], status: 'active', handoffMode: 'ai', intent: 'product question', minutesAgo: 12,
  messages: [
    { role: 'user', content: 'Do you have the Nordic sofa in grey, and does it come with the ottoman?', timestamp: new Date(Date.now() - 14 * 60000) },
    { role: 'assistant', content: 'Yes! The Nordic sofa comes in grey, charcoal, and sand. The ottoman is sold separately for ₦45,000, or as a bundle with the sofa for ₦15,000 off. Want me to check stock at your nearest showroom?', timestamp: new Date(Date.now() - 12 * 60000) },
  ],
});

makeConversation({
  contact: contacts[2], status: 'resolved', handoffMode: 'ai', intent: 'order status', minutesAgo: 190,
  messages: [
    { role: 'user', content: "What's the status of order #AR-10298?", timestamp: new Date(Date.now() - 200 * 60000) },
    { role: 'assistant', content: "Order #AR-10298 shipped yesterday and is out for delivery today between 10am-2pm. You'll get an SMS when it's close.", timestamp: new Date(Date.now() - 195 * 60000) },
    { role: 'user', content: 'Perfect, thank you!', timestamp: new Date(Date.now() - 191 * 60000) },
  ],
});

const kbDocs = [
  { title: 'Return & exchange policy', category: 'policies', tags: ['returns', 'refunds'], content: '30-day return window on all items in original condition...' },
  { title: 'Delivery timelines by region', category: 'faq', tags: ['shipping'], content: 'Lagos: 1-2 days. Other states: 3-5 business days...' },
  { title: 'Nordic sofa collection', category: 'products', tags: ['sofas', 'nordic'], content: 'Available in grey, charcoal, sand. Ottoman sold separately...' },
  { title: 'Showroom locations & hours', category: 'general', tags: [], content: 'Lekki, Ikeja, and Victoria Island showrooms...' },
];
for (const d of kbDocs) {
  const doc = new KnowledgeBase({ _id: oid(), businessId, ...d, subcategory: '', keywords: [], source: { type: 'manual' }, status: 'published', usageCount: Math.floor(Math.random() * 40), createdAt: new Date('2026-08-05') });
  db.kb.set(String(doc._id), doc);
}

const app = createApp();
attachErrorHandlers(app);
app.listen(process.env.PORT, () => {
  console.log(`Demo server on http://localhost:${process.env.PORT}`);
  console.log('Login: owner@acmeretail.test / DemoPass123!');
});
