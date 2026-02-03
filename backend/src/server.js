require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./db');
const userRoutes = require('./routes/userRoutes'); // Corrected path

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes); // User authentication routes

// GET /api/history - Fetch all history items
app.get('/api/history', async(req, res) => {
    try {
        console.log('GET /api/history - Fetching history');

        const items = await History.find().sort({ timestamp: -1 });
        res.json(items);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// POST /api/history - Add new history item
app.post('/api/history', async(req, res) => {
    try {
        const { code } = req.body;
        console.log('POST /api/history - Adding item:', code.name);

        const newItem = new History({ code });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error adding history item:', error);
        res.status(500).json({ error: 'Failed to add history item' });
    }
});

// DELETE /api/history/:id - Delete a history item (optional)
app.delete('/api/history/:id', async(req, res) => {
    try {
        const { id } = req.params;
        console.log('DELETE /api/history/:id - Deleting item:', id);

        await History.findByIdAndDelete(id);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting history item:', error);
        res.status(500).json({ error: 'Failed to delete history item' });
    }
});

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
});

module.exports = app;