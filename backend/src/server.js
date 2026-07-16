require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const connectDB = require('./db');
const protect = require('./middleware/authMiddleware');

// Routes
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const codeRoutes = require('./routes/codeRoutes');
const historyRoutes = require('./routes/historyRoutes');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

const app = express();

// Security Middleware
app.use(helmet()); // Set security HTTP headers
app.use((req, res, next) => {
    if (req.body) req.body = mongoSanitize(req.body);
    if (req.query) req.query = mongoSanitize(req.query);
    if (req.params) req.params = mongoSanitize(req.params);
    next();
}); // Prevent NoSQL injection attacks

// Rate Limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
	legacyHeaders: false,
});

// Apply rate limiting to authentication routes
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// CORS Configuration
// For development, we allow all origins. In production, this should be restricted.
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' })); // Reduced limit for better security
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
        socket.join(userId);
        console.log(`User ${userId} joined room ${userId}`);
        io.emit('user_status_change', { userId, status: 'online' });
    });

    socket.on('get_online_users', () => {
        socket.emit('online_users', Array.from(connectedUsers.keys()));
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
                io.emit('user_status_change', { userId, status: 'offline' });
                break;
            }
        }
    });
});

// Make io accessible in routes/controllers
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// Connect to MongoDB
connectDB();

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(uploadsDir));

// Routes
app.get('/', (req, res) => {
    res.send('Welcome to the ChromaCode API Server! 🚀');
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/conversations', protect, conversationRoutes);
app.use('/api/codes', protect, codeRoutes);
app.use('/api/history', protect, historyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
http.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Generic Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

module.exports = app;