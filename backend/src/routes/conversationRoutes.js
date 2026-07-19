const express = require('express');
const router = express.Router();
const multer = require('multer');
const CloudinaryStorage = require('../config/cloudinaryStorage');
const {
    startConversation,
    getConversations,
    createGroupChat,
    getConversation,
    sendMessage,
    updateGroupChat,
    leaveGroupChat,
    deleteGroupChat,
    markMessagesAsRead,
    uploadMessageMedia,
    getMessageMedia,
    addReaction,
    removeReaction,
    deleteMessage
} = require('../controllers/conversationController');

// Upload chat media (images, video, audio, documents) directly to Cloudinary
// instead of the server's local disk, which is wiped whenever Render's free
// tier redeploys, restarts, or spins down from inactivity.
const storage = new CloudinaryStorage({
    folder: 'chromacode/messages',
    // 'auto' lets Cloudinary detect image/video/raw (documents) automatically
    resourceType: 'auto',
});

const upload = multer({ storage });
const memoryUpload = multer({ storage: multer.memoryStorage() });

router.route('/')
    .post(startConversation)
    .get(getConversations);

router.post('/group', createGroupChat);
router.route('/upload').post(upload.single('file'), uploadMessageMedia);
router.route('/messages/:id/media').get(getMessageMedia);

router.get('/:id', getConversation);
router.put('/:id/read', markMessagesAsRead);
router.put('/:id/group', updateGroupChat);
router.delete('/:id/leave', leaveGroupChat);
router.delete('/:id', deleteGroupChat);


router.post('/:id/messages', sendMessage);
router.post('/:id/messages/:messageId/reactions', addReaction);
router.delete('/:id/messages/:messageId/reactions', removeReaction);
router.delete('/:id/messages/:messageId', deleteMessage);

module.exports = router;