const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import entire controller
const protect = require('../middleware/authMiddleware'); // Import protect function
const multer = require('multer');
const path = require('path');

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.route('/register').post(userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/verify-email', userController.verifyEmail);
router.post('/google-login', userController.googleLogin);

router.get('/search', protect, userController.searchUsers);
router.get('/friend-requests', protect, userController.getFriendRequests);
router.get('/friends', protect, userController.getFriends);
router.post('/friend-request', protect, userController.sendFriendRequest);
router.post('/friend-request/accept', protect, userController.acceptFriendRequest);
router.post('/friend-request/decline', protect, userController.declineFriendRequest);
router.put('/push-token', protect, userController.updatePushToken);

router.post('/block', protect, userController.blockUser);
router.post('/unblock', protect, userController.unblockUser);

router.post('/upload', protect, upload.single('image'), userController.uploadImage);

router.get('/', protect, userController.getUsers);
router
  .route('/profile')
  .get(protect, userController.getUserProfile)
  .put(protect, userController.updateUserProfile)
  .delete(protect, userController.deleteUserProfile);

module.exports = router;