const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async(req, res) => {
    console.log('POST /api/users/register - body:', req.body);
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

    // Create user
    const user = await User.create({
        username,
        email,
        password: hashedPassword,
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async(req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);
    console.log('Provided password:', password);

    // Check for user email
    const user = await User.findOne({ email });
    console.log('User found:', user ? user.email : 'None');

    if (user && (await bcrypt.compare(password, user.password))) {
        console.log('Password comparison successful.');
        res.json({
            _id: user.id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
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
      _id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePicture,
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
    await user.remove();
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
    username: { $regex: username, $options: 'i' }, // Case-insensitive search
    _id: { $ne: req.user._id }, // Exclude current user
  }).select('_id username profilePicture');

  res.json(users);
});

// @desc    Add a friend
// @route   POST /api/users/add-friend
// @access  Private
const addFriend = asyncHandler(async (req, res) => {
  const { friendId } = req.body;

  if (!friendId) {
    res.status(400);
    throw new Error('Please provide a friendId');
  }

  // Add friend to current user's friends list
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (!user.friends.includes(friendId)) {
    user.friends.push(friendId);
    await user.save();
  }

  // Add current user to friend's friends list (mutual friendship)
  const friend = await User.findById(friendId);
  if (!friend) {
    res.status(404);
    throw new Error('Friend not found');
  }
  if (!friend.friends.includes(req.user._id)) {
    friend.friends.push(req.user._id);
    await friend.save();
  }

  res.json({ message: 'Friend added successfully' });
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

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = {
    registerUser,
    loginUser,
    getUsers,
    getUserProfile,
    updateUserProfile,
    deleteUserProfile,
    searchUsers,
    addFriend,
    getFriends,
};