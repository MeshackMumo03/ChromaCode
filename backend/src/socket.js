const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');

/**
 * Socket.IO authentication: every connection must present the same JWT the
 * REST API uses (`io(url, { auth: { token } })`). The user ID is taken from
 * the verified token, never from anything the client sends, so a client can
 * only ever receive its own events.
 */
async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token || typeof token !== 'string') return next(new Error('unauthorized'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const exists = await User.exists({ _id: decoded.id });
    if (!exists) return next(new Error('unauthorized'));
    socket.data.userId = String(decoded.id);
    socket.data.conversations = new Set();
    return next();
  } catch {
    return next(new Error('unauthorized'));
  }
}

async function isConversationMember(userId, conversationId) {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  return Boolean(await Conversation.exists({ _id: conversationId, participants: userId }));
}

/** Joins a conversation room only if the user is a participant (cached per socket). */
async function ensureConversationAccess(socket, conversationId) {
  if (typeof conversationId !== 'string') return false;
  if (socket.data.conversations.has(conversationId)) return true;
  if (!(await isConversationMember(socket.data.userId, conversationId))) return false;
  socket.data.conversations.add(conversationId);
  socket.join(conversationId);
  return true;
}

function attachSocketHandlers(io, connectedUsers) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(userId);
    connectedUsers.set(userId, socket.id);
    io.emit('user_status_change', { userId, status: 'online' });

    // Older app versions still emit 'join' with their ID after connecting.
    // The room is already joined from the verified token; the payload is ignored.
    socket.on('join', () => {});

    socket.on('get_online_users', () => {
      socket.emit('online_users', Array.from(connectedUsers.keys()));
    });

    socket.on('join_conversation', async (conversationId) => {
      await ensureConversationAccess(socket, conversationId);
    });

    socket.on('typing', async ({ conversationId, senderName } = {}) => {
      if (!(await ensureConversationAccess(socket, conversationId))) return;
      socket.to(conversationId).emit('typing', { conversationId, senderId: userId, senderName });
    });

    socket.on('stop_typing', async ({ conversationId } = {}) => {
      if (!(await ensureConversationAccess(socket, conversationId))) return;
      socket.to(conversationId).emit('stop_typing', { conversationId, senderId: userId });
    });

    socket.on('disconnect', () => {
      if (connectedUsers.get(userId) === socket.id) {
        connectedUsers.delete(userId);
        io.emit('user_status_change', { userId, status: 'offline' });
      }
    });
  });
}

module.exports = { attachSocketHandlers, authenticateSocket };
