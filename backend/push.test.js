// Push notification tests against a real MongoDB and Socket.IO server.
// Runs when MONGO_TEST_URI is set (CI starts a mongo service); skipped otherwise.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-regression-test-only-not-a-deployment-secret';

const User = require('./src/models/User');
const { attachSocketHandlers, isUserActive } = require('./src/socket');
const { sendPushNotification, expo } = require('./src/utils/notifications');
const { updatePushToken } = require('./src/controllers/userController');

const uri = process.env.MONGO_TEST_URI;
const skip = !uri && 'MONGO_TEST_URI not set';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

let server; let io; let url; let api; let apiServer; let alice; let bob;
const activeSockets = new Map();
const clients = [];

before(async () => {
  if (skip) return;
  await mongoose.connect(uri, { dbName: `chromacode-push-test-${process.pid}` });
  [alice, bob] = await User.create(['alice', 'bob'].map((u) => ({
    username: u, email: `${u}@example.com`, password: 'hashed-password',
  })));

  server = http.createServer();
  io = new Server(server);
  attachSocketHandlers(io, new Map(), activeSockets);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;

  const app = express();
  app.use(express.json());
  app.use(async (req, res, next) => { req.user = await User.findById(req.headers['x-user']); next(); });
  app.put('/push-token', updatePushToken);
  app.use((err, req, res, next) => res.status(res.statusCode === 200 ? 500 : res.statusCode).json({ message: err.message }));
  apiServer = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  api = `http://127.0.0.1:${apiServer.address().port}`;
});

after(async () => {
  if (skip) return;
  for (const c of clients) c.disconnect();
  io.close();
  await new Promise((resolve) => apiServer.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const putToken = (user, pushToken) => fetch(`${api}/push-token`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user': String(user._id) }, body: JSON.stringify({ pushToken }),
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('push tokens: valid tokens are saved, junk is rejected, logout clears', { skip }, async () => {
  for (const bad of [undefined, 42, 'not-a-token', { $ne: '' }]) {
    assert.equal((await putToken(alice, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await putToken(alice, TOKEN_A)).status, 200);
  assert.equal((await User.findById(alice._id)).pushToken, TOKEN_A);
  assert.equal((await putToken(alice, '')).status, 200);
  assert.equal((await User.findById(alice._id)).pushToken, '');
});

test('a phone belongs to one account: logging in as bob on alice\'s phone moves the token', { skip }, async () => {
  await putToken(alice, TOKEN_A);
  await putToken(bob, TOKEN_A);
  assert.equal((await User.findById(alice._id)).pushToken, '');
  assert.equal((await User.findById(bob._id)).pushToken, TOKEN_A);
});

test('app on screen skips the push; app in background gets it', { skip }, async () => {
  const socket = connect(url, { auth: { token: jwt.sign({ id: bob._id }, process.env.JWT_SECRET) }, transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(socket);
  await new Promise((resolve) => socket.on('connect', resolve));
  await wait(50);
  assert.equal(isUserActive(activeSockets, bob._id), true, 'connected counts as on screen (older apps)');

  socket.emit('app_state', { active: false });
  await wait(50);
  assert.equal(isUserActive(activeSockets, bob._id), false);

  socket.emit('app_state', { active: true });
  await wait(50);
  assert.equal(isUserActive(activeSockets, bob._id), true);
  socket.emit('app_state', { active: 'yes' }); // ignored
  await wait(50);
  assert.equal(isUserActive(activeSockets, bob._id), true);

  socket.disconnect();
  await wait(100);
  assert.equal(isUserActive(activeSockets, bob._id), false);
});

test('sendPushNotification: skips on-screen users, sends the right payload, drops dead tokens', { skip }, async (t) => {
  await User.updateOne({ _id: bob._id }, { pushToken: TOKEN_B });
  const sent = [];
  let reply = [{ status: 'ok', id: 'x' }];
  t.mock.method(expo, 'sendPushNotificationsAsync', async (messages) => { sent.push(...messages); return reply; });
  t.mock.method(console, 'error', () => {});

  const onScreen = new Map([[String(bob._id), new Set(['socket-1'])]]);
  assert.equal(await sendPushNotification(bob._id, 'Alice', 'hi', { conversationId: alice._id }, onScreen), 'skipped-active');
  assert.equal(sent.length, 0);

  assert.equal(await sendPushNotification(bob._id, 'Alice', 'x'.repeat(500), { conversationId: alice._id }, new Map()), 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, TOKEN_B);
  assert.equal(sent[0].channelId, 'messages');
  assert.equal(sent[0].priority, 'high');
  assert.equal(sent[0].data.conversationId, String(alice._id));
  assert.ok(sent[0].body.length <= 180);

  assert.equal(await sendPushNotification(alice._id, 'Bob', 'hi', {}, new Map()), 'no-token');

  reply = [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }];
  assert.equal(await sendPushNotification(bob._id, 'Alice', 'hi', {}, new Map()), 'error');
  assert.equal((await User.findById(bob._id)).pushToken, '');
});
