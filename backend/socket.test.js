// Socket.IO authorisation tests against a real server and MongoDB.
// Runs when MONGO_TEST_URI is set (CI starts a mongo service); skipped otherwise.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'local-regression-test-only-not-a-deployment-secret';

const User = require('./src/models/User');
const Conversation = require('./src/models/Conversation');
const { attachSocketHandlers } = require('./src/socket');

const uri = process.env.MONGO_TEST_URI;
const skip = !uri && 'MONGO_TEST_URI not set';

let server; let io; let url; let alice; let bob; let mallory; let chat;
const clients = [];

before(async () => {
  if (skip) return;
  await mongoose.connect(uri, { dbName: `chromacode-socket-test-${process.pid}` });
  [alice, bob, mallory] = await User.create(['alice', 'bob', 'mallory'].map((u) => ({
    username: u, email: `${u}@example.com`, password: 'hashed-password',
  })));
  chat = await Conversation.create({ participants: [alice._id, bob._id] });

  server = http.createServer();
  io = new Server(server);
  attachSocketHandlers(io, new Map());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (skip) return;
  for (const c of clients) c.disconnect();
  io.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

function open(auth) {
  const socket = connect(url, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(socket);
  return new Promise((resolve) => {
    socket.on('connect', () => resolve({ socket, error: null }));
    socket.on('connect_error', (error) => resolve({ socket, error }));
  });
}

const received = (socket, event, ms = 300) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
});

test('connections without a valid token are rejected', { skip }, async () => {
  for (const auth of [undefined, {}, { token: 'not-a-jwt' },
    { token: jwt.sign({ id: alice._id }, 'wrong-secret') },
    { token: tokenFor({ _id: new mongoose.Types.ObjectId() }) }]) {
    const { error } = await open(auth);
    assert.ok(error, `expected rejection for ${JSON.stringify(auth)}`);
    assert.equal(error.message, 'unauthorized');
  }
});

test('a user cannot receive another user\'s messages by claiming their ID', { skip }, async () => {
  const { socket: bobSocket } = await open({ token: tokenFor(bob) });
  const { socket: malSocket, error } = await open({ token: tokenFor(mallory) });
  assert.equal(error, null);
  malSocket.emit('join', String(bob._id)); // old-style join with someone else's ID
  await new Promise((r) => setTimeout(r, 100));

  const bobGets = received(bobSocket, 'new_message');
  const malGets = received(malSocket, 'new_message');
  io.to(String(bob._id)).emit('new_message', { conversationId: chat._id, message: { text: 'secret' } });
  assert.equal((await bobGets).message.text, 'secret');
  assert.equal(await malGets, null);
});

test('only conversation members can join a conversation or send typing events to it', { skip }, async () => {
  const { socket: aliceSocket } = await open({ token: tokenFor(alice) });
  const { socket: bobSocket } = await open({ token: tokenFor(bob) });
  const { socket: malSocket } = await open({ token: tokenFor(mallory) });
  const chatId = String(chat._id);
  for (const s of [aliceSocket, bobSocket, malSocket]) s.emit('join_conversation', chatId);
  malSocket.emit('join_conversation', 'not-an-id');
  await new Promise((r) => setTimeout(r, 150));

  // Mallory joined nothing, so room broadcasts don't reach her.
  const malRoom = received(malSocket, 'message_deleted');
  io.to(chatId).emit('message_deleted', { conversationId: chatId, messageId: 'x' });
  assert.equal(await malRoom, null);

  // Mallory's typing events are dropped; members' arrive with the real sender ID.
  const bobFromMal = received(bobSocket, 'typing');
  malSocket.emit('typing', { conversationId: chatId, senderId: String(alice._id), senderName: 'alice' });
  assert.equal(await bobFromMal, null);

  const bobFromAlice = received(bobSocket, 'typing');
  aliceSocket.emit('typing', { conversationId: chatId, senderId: String(mallory._id), senderName: 'Alice' });
  const event = await bobFromAlice;
  assert.equal(event.senderId, String(alice._id));
});
