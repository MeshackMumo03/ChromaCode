const express = require('express');
const router = express.Router();
const HistoryItem = require('../models/HistoryItem'); // Assuming HistoryItem model is available
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

// GET /api/history - Fetch all history items for the logged-in user
router.get('/', async (req, res) => {
    try {
        // Ensure that only history items belonging to the logged-in user are fetched
        const items = await HistoryItem.find({ user: req.user.id }).populate('recipient', 'username').sort({ timestamp: -1 });
        res.json(items);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// POST /api/history - Add new history item for the logged-in user
router.post('/', async (req, res) => {
    try {
        const { code, conversationId, recipientId } = req.body; // recipientId is now passed
        
        // Ensure that the history item is associated with the logged-in user
        const newItem = new HistoryItem({
            user: req.user.id, // Associate with the logged-in user
            code,
            conversationId,
            recipient: recipientId, // Store the recipient's ID
        });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error adding history item:', error);
        res.status(500).json({ error: 'Failed to add history item' });
    }
});

// DELETE /api/history/:id - Delete a history item for the logged-in user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await HistoryItem.findById(id);

        if (!item) {
            res.status(404);
            throw new Error('History item not found');
        }

        // Make sure the logged in user owns the history item
        if (item.user.toString() !== req.user.id) {
            res.status(401);
            throw new Error('User not authorized');
        }

        await item.remove();
        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting history item:', error);
        res.status(500).json({ error: 'Failed to delete history item' });
    }
});

module.exports = router;
