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
const Conversation = require('./models/Conversation');

// Security Check: Ensure required environment variables are set
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined.');
    process.exit(1);
}

if (!process.env.MESSAGE_ENCRYPTION_KEY || process.env.MESSAGE_ENCRYPTION_KEY.length !== 64) {
    console.error('FATAL ERROR: MESSAGE_ENCRYPTION_KEY must be a 64-character hex string.');
    process.exit(1);
}

// Routes
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const codeRoutes = require('./routes/codeRoutes');
const historyRoutes = require('./routes/historyRoutes');
const botRoutes = require('./bot/routes/botRoutes');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy, so Express needs
// to be told to trust the X-Forwarded-For header it sets. Without this,
// express-rate-limit can't reliably identify client IPs and logs a
// validation warning on every request.
app.set('trust proxy', 1);

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

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many verification attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to authentication routes
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/reset-password', authLimiter);
app.use('/api/users/verify-email', verifyLimiter);
app.use('/api/users/resend-verification', verifyLimiter);

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' })); // Reduced limit for better security
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const http = require('http').createServer(app);

const socketCorsOrigin = (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!origin) return callback(null, true); // allow mobile/native clients with no origin
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
};

const io = require('socket.io')(http, {
    cors: {
        origin: socketCorsOrigin,
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 5000;

// Socket.io connection handling
const connectedUsers = new Map(); // userId -> Set<socketId>

io.on('connection', (socket) => {
    socket.on('join', (userId) => {
        if (!mongoose.Types.ObjectId.isValid(userId)) return;

        if (!connectedUsers.has(userId)) {
            connectedUsers.set(userId, new Set());
            io.emit('user_status_change', { userId, status: 'online' });
        }
        connectedUsers.get(userId).add(socket.id);
        socket.userId = userId;
        socket.join(userId);
    });

    socket.on('get_online_users', () => {
        socket.emit('online_users', Array.from(connectedUsers.keys()).filter(id => connectedUsers.get(id).size > 0));
    });

    socket.on('bot_signal_event', (data) => {
        io.emit('bot_signal_received', data);
    });

    socket.on('join_conversation', async (conversationId) => {
        if (!socket.userId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

        try {
            const conversation = await Conversation.findOne({
                _id: conversationId,
                participants: socket.userId
            });

            if (!conversation) {
                socket.emit('error', { message: 'Not authorized to join this conversation' });
                return;
            }

            socket.join(conversationId);
        } catch (err) {
            socket.emit('error', { message: 'Failed to join conversation' });
        }
    });

    socket.on('typing', async ({ conversationId, senderId, senderName }) => {
        if (!socket.userId || socket.userId.toString() !== senderId?.toString()) return;
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

        try {
            const conversation = await Conversation.findOne({
                _id: conversationId,
                participants: socket.userId
            });

            if (!conversation) return;

            socket.to(conversationId).emit('typing', { conversationId, senderId, senderName });
        } catch (err) {
            // ignore
        }
    });

    socket.on('stop_typing', async ({ conversationId, senderId }) => {
        if (!socket.userId || socket.userId.toString() !== senderId?.toString()) return;
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

        try {
            const conversation = await Conversation.findOne({
                _id: conversationId,
                participants: socket.userId
            });

            if (!conversation) return;

            socket.to(conversationId).emit('stop_typing', { conversationId, senderId });
        } catch (err) {
            // ignore
        }
    });

    socket.on('disconnect', () => {
        for (const [userId, sockets] of connectedUsers.entries()) {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    connectedUsers.delete(userId);
                    io.emit('user_status_change', { userId, status: 'offline' });
                }
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
    res.send('Welcome to the ChromaCode API Server!');
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/conversations', protect, conversationRoutes);
app.use('/api/codes', protect, codeRoutes);
app.use('/api/history', protect, historyRoutes);
app.use('/api/bot', botRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
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
