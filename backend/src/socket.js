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
    return next();
  } catch {
    return next(new Error('unauthorized'));
  }
}

/**
 * The personal rooms of a conversation's other members, or null if the user isn't
 * a member. Checked on every event, so someone removed from a group stops at once.
 */
async function otherMemberRooms(userId, conversationId) {
  if (typeof conversationId !== 'string' || !mongoose.isValidObjectId(conversationId)) return null;
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId }).select('participants').lean();
  if (!conversation) return null;
  return conversation.participants.map(String).filter((id) => id !== userId);
}

/**
 * activeSockets: userId -> Set of socket IDs whose app is on screen. Push
 * notifications are skipped only for users in here. Apps that never report
 * their state (older versions) count as on screen while connected, which is
 * how push behaved before.
 */
function setActive(activeSockets, userId, socketId, active) {
  const set = activeSockets.get(userId) ?? new Set();
  if (active) set.add(socketId);
  else set.delete(socketId);
  if (set.size) activeSockets.set(userId, set);
  else activeSockets.delete(userId);
}

function isUserActive(activeSockets, userId) {
  return Boolean(activeSockets?.get(String(userId))?.size);
}

function attachSocketHandlers(io, connectedUsers, activeSockets = new Map()) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(userId);
    connectedUsers.set(userId, socket.id);
    setActive(activeSockets, userId, socket.id, true);
    io.emit('user_status_change', { userId, status: 'online' });

    socket.on('app_state', (payload) => {
      if (payload && typeof payload.active === 'boolean') {
        setActive(activeSockets, userId, socket.id, payload.active);
      }
    });

    // Older app versions still emit 'join' with their ID after connecting.
    // The room is already joined from the verified token; the payload is ignored.
    socket.on('join', () => {});

    socket.on('get_online_users', () => {
      socket.emit('online_users', Array.from(connectedUsers.keys()));
    });

    socket.on('typing', async ({ conversationId, senderName } = {}) => {
      const rooms = await otherMemberRooms(userId, conversationId);
      if (rooms?.length) socket.to(rooms).emit('typing', { conversationId, senderId: userId, senderName });
    });

    socket.on('stop_typing', async ({ conversationId } = {}) => {
      const rooms = await otherMemberRooms(userId, conversationId);
      if (rooms?.length) socket.to(rooms).emit('stop_typing', { conversationId, senderId: userId });
    });

    socket.on('disconnect', () => {
      setActive(activeSockets, userId, socket.id, false);
      if (connectedUsers.get(userId) === socket.id) {
        connectedUsers.delete(userId);
        io.emit('user_status_change', { userId, status: 'offline' });
      }
    });
  });
}

module.exports = { attachSocketHandlers, authenticateSocket, isUserActive };
