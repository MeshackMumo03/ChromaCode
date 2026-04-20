const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// Configure nodemailer transporter
// Note: You will need to add EMAIL_USER and EMAIL_PASS to your .env file
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: `"ChromaCode" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'ChromaCode - Verify Your Account',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to ChromaCode!</h2>
        <p>Please use the following verification code to complete your registration:</p>
        <div style="font-size: 32px; font-weight: bold; padding: 10px; background: #f4f4f4; text-align: center; letter-spacing: 5px;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user (unverified)
    const user = await User.create({
        username,
        email,
        password: hashedPassword,
        isVerified: false, 
        verificationCode,
    });

    if (user) {
        // Send email
        sendVerificationEmail(email, verificationCode);

        res.status(201).json({
            _id: user.id,
            username: user.username,
            email: user.email,
            message: 'Verification code sent to your email'
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Verify email
// @route   POST /api/users/verify-email
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.verificationCode !== code) {
    res.status(400);
    throw new Error('Invalid verification code');
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  await user.save();

  res.json({
    _id: user.id,
    username: user.username,
    email: user.email,
    token: generateToken(user._id),
    message: 'Email verified successfully!'
  });
});

// @desc    Authenticate with Google
// @route   POST /api/users/google-login
// @access  Public
const googleLogin = asyncHandler(async (req, res) => {
  const { email, username, profilePicture } = req.body;

  let user = await User.findOne({ email });

  if (user) {
    // Existing user - if they log in with Google, we trust the email is verified
    user.isVerified = true;
    user.isGoogleUser = true;
    user.verificationCode = undefined;
    await user.save();
  } else {
    // Create new Google user (verified by default)
    user = await User.create({
      username,
      email,
      password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
      profilePicture: profilePicture || 'https://www.gravatar.com/avatar/?d=mp',
      isVerified: true, 
      isGoogleUser: true,
    });
  }

  res.json({
    _id: user.id,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    friends: user.friends,
    pushToken: user.pushToken,
    token: generateToken(user._id),
  });
});

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        if (!user.isVerified) {
          // Resend code if trying to login unverified
          const newCode = Math.floor(100000 + Math.random() * 900000).toString();
          user.verificationCode = newCode;
          await user.save();
          sendVerificationEmail(email, newCode);
          
          res.status(401);
          throw new Error('Please verify your email. A new code has been sent.');
        }

        res.json({
            _id: user.id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            friends: user.friends,
            pushToken: user.pushToken,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid credentials');
    }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
  res.json(users);
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.profilePicture = req.body.profilePicture || user.profilePicture;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      user: {
        _id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        friends: updatedUser.friends,
        pushToken: updatedUser.pushToken,
      },
      token: generateToken(updatedUser._id),
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Delete user profile
// @route   DELETE /api/users/profile
// @access  Private
const deleteUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    await user.deleteOne();
    res.json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Search users by username
// @route   GET /api/users/search?username=<searchTerm>
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const { username } = req.query;

  if (!username) {
    res.status(400);
    throw new Error('Please provide a username to search');
  }

  const users = await User.find({
    username: { $regex: username, $options: 'i' }, 
    _id: { $ne: req.user._id }, 
  }).select('_id username profilePicture');

  res.json(users);
});

// @desc    Send a friend request
// @route   POST /api/users/friend-request
// @access  Private
const sendFriendRequest = asyncHandler(async (req, res) => {
  const { friendId } = req.body;

  if (!friendId) {
    res.status(400);
    throw new Error('Please provide a friendId');
  }

  if (friendId === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot send a friend request to yourself');
  }

  const targetUser = await User.findById(friendId);
  if (!targetUser) {
    res.status(404);
    throw new Error('User not found');
  }

  if (targetUser.friends.includes(req.user._id)) {
    res.status(400);
    throw new Error('Already friends');
  }

  const alreadyRequested = targetUser.friendRequests.some(
    (request) => request.from.toString() === req.user._id.toString()
  );

  if (alreadyRequested) {
    res.status(400);
    throw new Error('Friend request already sent');
  }

  targetUser.friendRequests.push({ from: req.user._id });
  await targetUser.save();

  res.json({ message: 'Friend request sent' });
});

// @desc    Accept a friend request
// @route   POST /api/users/friend-request/accept
// @access  Private
const acceptFriendRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.body;

  const user = await User.findById(req.user._id);
  
  const requestIndex = user.friendRequests.findIndex(
    (req) => req._id.toString() === requestId
  );

  if (requestIndex === -1) {
    res.status(404);
    throw new Error('Friend request not found');
  }

  const requesterId = user.friendRequests[requestIndex].from;

  user.friends.push(requesterId);
  user.friendRequests.splice(requestIndex, 1);
  await user.save();

  const requester = await User.findById(requesterId);
  requester.friends.push(user._id);
  await requester.save();

  res.json({ message: 'Friend request accepted' });
});

// @desc    Decline a friend request
// @route   POST /api/users/friend-request/decline
// @access  Private
const declineFriendRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.body;

  const user = await User.findById(req.user._id);
  user.friendRequests = user.friendRequests.filter(
    (req) => req._id.toString() !== requestId
  );
  await user.save();

  res.json({ message: 'Friend request declined' });
});

// @desc    Get pending friend requests
// @route   GET /api/users/friend-requests
// @access  Private
const getFriendRequests = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('friendRequests.from', 'username profilePicture');
  res.json(user.friendRequests);
});

// @desc    Get user's friends
// @route   GET /api/users/friends
// @access  Private
const getFriends = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends', '_id username profilePicture');
  if (user) {
    res.json(user.friends);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user push token
// @route   PUT /api/users/push-token
// @access  Private
const updatePushToken = asyncHandler(async (req, res) => {
  const { pushToken } = req.body;
  const user = await User.findById(req.user._id);

  if (user) {
    user.pushToken = pushToken;
    await user.save();
    res.json({ message: 'Push token updated' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Block a user
// @route   POST /api/users/block
// @access  Private
const blockUser = asyncHandler(async (req, res) => {
  const { userIdToBlock } = req.body;
  const user = await User.findById(req.user._id);

  if (user.blockedUsers.includes(userIdToBlock)) {
    res.status(400);
    throw new Error('User already blocked');
  }

  user.blockedUsers.push(userIdToBlock);
  await user.save();

  res.json({ message: 'User blocked successfully' });
});

// @desc    Unblock a user
// @route   POST /api/users/unblock
// @access  Private
const unblockUser = asyncHandler(async (req, res) => {
  const { userIdToUnblock } = req.body;
  const user = await User.findById(req.user._id);

  user.blockedUsers = user.blockedUsers.filter(
    id => id.toString() !== userIdToUnblock
  );
  await user.save();

  res.json({ message: 'User unblocked successfully' });
});

// @desc    Upload an image
// @route   POST /api/users/upload
// @access  Private
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload an image');
  }

  // Return the path that can be used to access the image
  // We'll return just the relative path from the server root
  const imagePath = `/uploads/${req.file.filename}`;
  res.json({ imageUrl: imagePath });
});

module.exports = {
    registerUser,
    loginUser,
    verifyEmail,
    googleLogin,
    getUsers,
    getUserProfile,
    updateUserProfile,
    deleteUserProfile,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    getFriendRequests,
    getFriends,
    updatePushToken,
    blockUser,
    unblockUser,
    uploadImage,
};
