// Regression tests for account takeover, chat authorization and live delivery.
// Runs when MONGO_TEST_URI is set (CI starts a mongo service); skipped otherwise.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const mongoSanitize = require('mongo-sanitize');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-regression-test-only-not-a-deployment-secret';
process.env.CHROMACODE_BOT_TOKEN = 'test-bot-token';

const User = require('./src/models/User');
const Message = require('./src/models/Message');
const protect = require('./src/middleware/authMiddleware');
const errorHandler = require('./src/middleware/errorHandler');
const userRoutes = require('./src/routes/userRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const botRoutes = require('./src/bot/routes/botRoutes');
const { attachSocketHandlers } = require('./src/socket');

const uri = process.env.MONGO_TEST_URI;
const skip = !uri && 'MONGO_TEST_URI not set';
const PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuuPlaceholderPlaceholderPlaceholder';

let server; let io; let base; let alice; let bob; let mallory;
const clients = [];

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function call(method, path, { as, body } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(as ? { Authorization: `Bearer ${tokenFor(as)}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

function open(user) {
  const socket = connect(base, { auth: { token: tokenFor(user) }, transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(socket);
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

const received = (socket, event, ms = 400) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
});

before(async () => {
  if (skip) return;
  await mongoose.connect(uri, { dbName: `chromacode-api-test-${process.pid}` });
  await User.init();
  [alice, bob, mallory] = await User.create(['alice', 'bob', 'mallory'].map((username) => ({
    username, email: `${username}@example.com`, password: PASSWORD_HASH,
  })));

  const app = express();
  server = http.createServer(app);
  io = new Server(server);
  attachSocketHandlers(io, new Map());
  app.set('io', io);
  app.set('connectedUsers', new Map());
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    mongoSanitize(req.body);
    next();
  });
  app.use('/api/users', userRoutes);
  app.use('/api/conversations', protect, conversationRoutes);
  app.use('/api/bot', botRoutes);
  app.use(errorHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (skip) return;
  for (const client of clients) client.disconnect();
  io.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('verify-email never logs in to a verified account', { skip }, async () => {
  for (const body of [{ email: alice.email }, { email: alice.email, code: '123456' }, { email: { $ne: null } }]) {
    const { status, data } = await call('POST', '/users/verify-email', { body });
    assert.equal(status, 400, JSON.stringify(body));
    assert.equal(data.token, undefined);
  }
});

test('verification codes expire and die after too many wrong guesses', { skip }, async () => {
  const pending = await User.create({
    username: 'pending', email: 'pending@example.com', password: PASSWORD_HASH,
    isVerified: false, verificationCode: '111111', verificationCodeSentAt: new Date(Date.now() - 11 * 60 * 1000),
  });
  let result = await call('POST', '/users/verify-email', { body: { email: pending.email, code: '111111' } });
  assert.equal(result.status, 400);

  await User.updateOne({ _id: pending._id }, { verificationCodeSentAt: new Date() });
  for (let i = 0; i < 5; i += 1) await call('POST', '/users/verify-email', { body: { email: pending.email, code: '000000' } });
  result = await call('POST', '/users/verify-email', { body: { email: pending.email, code: '111111' } });
  assert.equal(result.status, 400);
  assert.equal(result.data.token, undefined);
});

test('operator injection in login is refused', { skip }, async () => {
  const { status } = await call('POST', '/users/login', { body: { email: { $ne: null }, password: 'x' } });
  assert.equal(status, 401);
});

test('other users\' secrets and emails are never exposed', { skip }, async () => {
  await User.updateOne({ _id: bob._id }, { resetPasswordCode: '222222', verificationCode: '333333', pushToken: 'secret' });
  const { data } = await call('GET', '/users', { as: mallory });
  const seen = data.find((u) => u._id === String(bob._id));
  assert.deepEqual(Object.keys(seen).sort(), ['_id', 'profilePicture', 'username']);

  const own = await call('GET', '/users/profile', { as: bob });
  for (const field of ['password', 'resetPasswordCode', 'verificationCode']) assert.equal(own.data[field], undefined);
});

test('short passwords are refused', { skip }, async () => {
  const register = await call('POST', '/users/register', { body: { username: 'weak', email: 'weak@example.com', password: '1' } });
  assert.equal(register.status, 400);
  const update = await call('PUT', '/users/profile', { as: alice, body: { password: '1' } });
  assert.equal(update.status, 400);
});

test('bad input gets a clear 4xx with no internals', { skip }, async () => {
  const duplicate = await call('PUT', '/users/profile', { as: alice, body: { username: bob.username } });
  assert.equal(duplicate.status, 400);
  assert.doesNotMatch(duplicate.data.message, /E11000/);
  const badId = await call('GET', '/conversations/not-an-id', { as: alice });
  assert.equal(badId.status, 400);
  assert.equal(badId.data.stack, undefined);
  const search = await call('GET', `/users/search?username=${encodeURIComponent('[')}`, { as: alice });
  assert.equal(search.status, 200);
  const wildcard = await call('GET', `/users/search?username=${encodeURIComponent('.*')}`, { as: alice });
  assert.deepEqual(wildcard.data, []);
});

test('replies are delivered live, to members only', { skip }, async () => {
  const start = await call('POST', '/conversations', { as: alice, body: { recipientId: String(bob._id), text: 'hello' } });
  const chatId = start.data.conversation._id;
  const [aliceSocket, malSocket] = await Promise.all([open(alice), open(mallory)]);

  const aliceGets = received(aliceSocket, 'new_message');
  const malGets = received(malSocket, 'new_message');
  await call('POST', `/conversations/${chatId}/messages`, { as: bob, body: { text: 'reply' } });
  assert.equal((await aliceGets).message.text, 'reply');
  assert.equal(await malGets, null);
});

test('reactions, read receipts and deletions need membership and reach members', { skip }, async () => {
  // The Home screen opens a chat with a friend by sending no content at all.
  const opened = await call('POST', '/conversations', { as: mallory, body: { recipientId: String(alice._id) } });
  assert.equal(opened.status, 200);
  assert.equal(opened.data.message, null);
  const chat = await call('POST', '/conversations', { as: alice, body: { recipientId: String(bob._id), text: 'private' } });
  const chatId = chat.data.conversation._id;
  const messageId = chat.data.message._id;

  const bobSocket = await open(bob);
  const reaction = received(bobSocket, 'message_reaction');
  const ok = await call('POST', `/conversations/${chatId}/messages/${messageId}/reactions`, { as: alice, body: { emoji: '👍' } });
  assert.equal(ok.status, 200);
  assert.equal((await reaction).messageId, messageId);

  assert.equal((await call('POST', `/conversations/${chatId}/messages/${messageId}/reactions`, { as: mallory, body: { emoji: '💀' } })).status, 404);
  assert.equal((await call('POST', `/conversations/${chatId}/messages/${messageId}/reactions`, { as: alice, body: {} })).status, 400);
  assert.equal((await call('PUT', `/conversations/${chatId}/read`, { as: mallory })).status, 404);
  assert.equal((await Message.findById(messageId)).readBy.map(String).includes(String(mallory._id)), false);

  const deleted = received(bobSocket, 'message_deleted');
  assert.equal((await call('DELETE', `/conversations/${chatId}/messages/${messageId}`, { as: alice })).status, 200);
  assert.equal((await deleted).messageId, messageId);
});

test('blocked users cannot reach the person who blocked them', { skip }, async () => {
  const blocker = await User.create({ username: 'blocker', email: 'blocker@example.com', password: PASSWORD_HASH, blockedUsers: [mallory._id] });
  const start = await call('POST', '/conversations', { as: mallory, body: { recipientId: String(blocker._id), text: 'hi' } });
  assert.equal(start.status, 403);
  const friend = await call('POST', '/users/friend-request', { as: mallory, body: { friendId: String(blocker._id) } });
  assert.equal(friend.status, 404);
});

test('a direct message never lands in a two-person group', { skip }, async () => {
  const group = await call('POST', '/conversations/group', { as: bob, body: { name: 'Pair', participants: [String(mallory._id)] } });
  const dm = await call('POST', '/conversations', { as: bob, body: { recipientId: String(mallory._id), text: 'direct' } });
  assert.notEqual(dm.data.conversation._id, group.data._id);
  assert.equal(dm.data.conversation.isGroup, false);
});

test('bot routes need the bot token', { skip }, async () => {
  assert.equal((await call('GET', '/bot/signals')).status, 401);
  assert.equal((await call('POST', '/bot/signals', { body: { signalText: 'spoof' } })).status, 401);
  const response = await fetch(`${base}/api/bot/analytics`, { headers: { Authorization: 'Bearer test-bot-token' } });
  assert.equal(response.status, 200);
});
