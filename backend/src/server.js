require('dotenv').config();
// Don't load dotenv here - it's already loaded by dotenv-cli in package.json
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./db');
const userRoutes = require('./routes/userRoutes'); // Uncommented
const conversationRoutes = require('./routes/conversationRoutes');
const codeRoutes = require('./routes/codeRoutes'); // Add this line
const historyRoutes = require('./routes/historyRoutes'); // Add this line

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 5000;

// Socket.io connection handling
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (userId) => {
        connectedUsers.set(userId, socket.id);
        console.log(`User ${userId} joined with socket ${socket.id}`);
        // Broadcast that this user is now online
        io.emit('user_status_change', { userId, status: 'online' });
    });

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation room ${conversationId}`);
    });

    socket.on('typing', ({ conversationId, senderId, senderName }) => {
        socket.to(conversationId).emit('typing', { conversationId, senderId, senderName });
    });

    socket.on('stop_typing', ({ conversationId, senderId }) => {
        socket.to(conversationId).emit('stop_typing', { conversationId, senderId });
    });

    socket.on('disconnect', () => {
        for (const [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                console.log(`User ${userId} disconnected`);
                // Broadcast that this user is now offline
                io.emit('user_status_change', { userId, status: 'offline' });
                break;
            }
        }
    });
});

// Make io accessible in routes/controllers
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// Debug: Check if JWT_SECRET is loaded
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES ✓' : 'NO ✗');

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Simple request logger for debugging
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

// Temporary echo endpoint to verify JSON POSTs from devices/emulators
app.post('/api/echo', express.json(), (req, res) => {
    console.log('ECHO /api/echo body:', req.body);
    res.json({ ok: true, received: req.body });
});

// Handle malformed JSON errors from body-parser and return JSON
app.use((err, req, res, next) => {
    // body-parser throws a SyntaxError for invalid JSON; newer versions may set err.type
    if (
        err && (
            err.type === 'entity.parse.failed' ||
            err instanceof SyntaxError ||
            (err.status === 400 && typeof err.body === 'string')
        )
    ) {
        console.error('Malformed JSON in request body:', err.message || err);
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    next(err);
});

// Test route
app.post('/api/test', (req, res) => {
    res.send('Test POST worked!');
});


// Routes
// Log headers and body for register requests to aid debugging (placed before userRoutes)
app.use('/api/users/register', (req, res, next) => { // Uncommented
    console.log('--- /api/users/register incoming ---');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl || req.url);
    console.log('Headers:', req.headers);
    // body may not be parsed if JSON invalid; attempt to log req.body safely
    try {
        console.log('Body:', req.body);
    } catch (e) {
        console.log('Body: <unreadable>');
    }
    console.log('-----------------------------------');
    next();
});
app.use('/api/users', userRoutes); // User authentication routes // Uncommented

// Custom middleware to apply protection
const customProtectMiddleware = (req, res, next) => {
    // Manually import authMiddleware here to try and bypass circular dependency issues
    const authMiddleware = require('./middleware/authMiddleware');
    authMiddleware(req, res, next);
};

app.use('/api/conversations', customProtectMiddleware);
app.use('/api/codes', customProtectMiddleware);
app.use('/api/history', customProtectMiddleware);

app.use('/api/conversations', conversationRoutes); // Conversation routes
app.use('/api/codes', codeRoutes); // Code routes
app.use('/api/history', historyRoutes); // History routes // Add this line

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
http.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Generic Error Handler (must be last middleware)
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

module.exports = app;