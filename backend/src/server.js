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
const { attachSocketHandlers } = require('./socket');

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
    console.log('Created uploads directory:', uploadsDir);
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

// Apply rate limiting to authentication routes
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/reset-password', authLimiter);

// CORS Configuration
// For development, we allow all origins. In production, this should be restricted.
const corsOptions = require('./config/cors');
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' })); // Reduced limit for better security
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: corsOptions
});
const PORT = process.env.PORT || 5000;

// Socket.io connection handling (JWT-authenticated, see src/socket.js)
const connectedUsers = new Map(); // userId -> socketId
attachSocketHandlers(io, connectedUsers);

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
app.use('/api/bot', botRoutes);

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