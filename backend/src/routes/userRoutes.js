const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import entire controller
const protect = require('../middleware/authMiddleware'); // Import protect function
const multer = require('multer');
const CloudinaryStorage = require('../config/cloudinaryStorage');

// Upload profile pictures directly to Cloudinary instead of the server's
// local disk, which is wiped on every Render restart/redeploy/spin-down.
const storage = new CloudinaryStorage({
  folder: 'chromacode/profile-pictures',
  resourceType: 'image',
});

const upload = multer({ storage });

router.route('/register').post(userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/verify-email', userController.verifyEmail);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
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