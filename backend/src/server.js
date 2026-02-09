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
const PORT = process.env.PORT || 5000;

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
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoints:`);
    console.log(`   GET    http://localhost:${PORT}/api/health`);
    console.log(`   GET    http://localhost:${PORT}/api/history`);
    console.log(`   POST   http://localhost:${PORT}/api/history`);
    console.log(`   DELETE http://localhost:${PORT}/api/history/:id`);
    console.log(`   POST   http://localhost:${PORT}/api/users/register`);
    console.log(`   POST   http://localhost:${PORT}/api/users/login`);
    console.log(`   GET    http://localhost:${PORT}/api/users/search`);
    console.log(`   POST   http://localhost:${PORT}/api/users/add-friend`);
    console.log(`   GET    http://localhost:${PORT}/api/users/friends`);
    console.log(`   GET    http://localhost:${PORT}/api/users/profile`);
    console.log(`   PUT    http://localhost:${PORT}/api/users/profile`);
    console.log(`   DELETE http://localhost:${PORT}/api/users/profile`);
    console.log(`   GET    http://localhost:${PORT}/api/codes`);
    console.log(`   POST   http://localhost:${PORT}/api/codes`);
    console.log(`   PUT    http://localhost:${PORT}/api/codes/:id`);
    console.log(`   DELETE http://localhost:${PORT}/api/codes/:id`);
    console.log(`   POST   http://localhost:${PORT}/api/test`);
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