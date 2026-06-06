const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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
  removeReaction
} = require('../controllers/conversationController');

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.resolve(__dirname, '../../uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
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

module.exports = router;
