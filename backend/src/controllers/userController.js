const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { randomInt, randomBytes } = require('node:crypto');
const User = require('../models/User');
const { verifyGoogleIdToken } = require('../utils/googleAuth');
const { deleteAccount } = require('../utils/deleteAccount');

// Security Check: Ensure environment variables are set
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.');
  process.exit(1);
}

// Send an email via Brevo's HTTP API (https://brevo.com) instead of raw
// SMTP. Render's free tier blocks all outbound traffic to SMTP ports
// (25/465/587) at the network level, so Brevo's SMTP relay (port 587) can
// never work there — Brevo's REST API sends over HTTPS (port 443), which
// isn't blocked.
//
// NOTE: the "sender" email below must be added and verified as a Sender in
// your Brevo dashboard (Settings -> Senders, Domains & Dedicated IPs ->
// Senders) before this will work — Brevo rejects sends from unverified
// sender addresses. This is separate from full domain verification; you
// can verify a single email address without owning a domain, though full
// domain verification (SPF/DKIM) improves deliverability and removes the
// "Sent via Brevo" branding on outgoing emails.
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'ChromaCode';

const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
    }

    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const sendVerificationEmail = async (email, code) => {
  await sendEmail({
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
  });
};

const sendPasswordResetEmail = async (email, code) => {
  await sendEmail({
    to: email,
    subject: 'ChromaCode - Reset Your Password',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Reset your ChromaCode password</h2>
        <p>We received a request to reset the password for this account. Use the code below to continue:</p>
        <div style="font-size: 32px; font-weight: bold; padding: 10px; background: #f4f4f4; text-align: center; letter-spacing: 5px;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
      </div>
    `,
  });
};

// List of common disposable email domains to block bots
const DISPOSABLE_EMAIL_DOMAINS = [
  'yopmail.com', 'mailinator.com', 'tempmail.com', 'guerrillamail.com', 
  'sharklasers.com', 'dispostable.com', '10minutemail.com', 'trashmail.com',
  'maildrop.cc', 'getnada.com', 'mintemail.com', 'protonmail.ch', // Some people use proton for bots, but it's legitimate too. Let's stick to obvious temp ones.
  'maildrop.cc', 'temp-mail.org', 'fake-mail.com'
];

const MIN_PASSWORD_LENGTH = 6;
const CODE_LIFETIME_MS = 10 * 60 * 1000; // The emails promise 10 minutes
const MAX_CODE_ATTEMPTS = 5;

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fields safe to show one user about another (search, chats, friend lists).
const PUBLIC_USER_FIELDS = '_id username profilePicture';
// Fields only the account owner may see, and never the secrets.
const PRIVATE_USER_EXCLUSIONS = '-password -verificationCode -verificationCodeSentAt -resetPasswordCode -resetPasswordExpires -codeAttempts';

// Counts a wrong guess, and destroys the code once the limit is reached.
const recordFailedCodeAttempt = async (user, clearCode) => {
  user.codeAttempts = (user.codeAttempts || 0) + 1;
  if (user.codeAttempts >= MAX_CODE_ATTEMPTS) {
    clearCode(user);
    user.codeAttempts = 0;
  }
  await user.save();
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!isNonEmptyString(username) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        res.status(400);
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error('Please provide a valid email address');
    }

    // Check for disposable/bot email domains
    const domain = email.split('@')[1].toLowerCase();
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
        res.status(400);
        throw new Error('Registration from this email provider is not allowed. Please use a standard email service.');
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
    const verificationCode = randomInt(100000, 1000000).toString();

    // Create user (unverified)
    const user = await User.create({
        username,
        email,
        password: hashedPassword,
        isVerified: false,
        verificationCode,
        verificationCodeSentAt: new Date(),
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

  if (!isNonEmptyString(email) || !isNonEmptyString(code)) {
    res.status(400);
    throw new Error('Please provide your email and verification code');
  }

  const user = await User.findOne({ email });

  // A verified account has no code left to match, and this endpoint hands out a
  // login token, so it must only ever succeed for a pending verification.
  if (!user || user.isVerified || !user.verificationCode) {
    res.status(400);
    throw new Error('Invalid verification code');
  }

  const expired = !user.verificationCodeSentAt
    || Date.now() - user.verificationCodeSentAt.getTime() > CODE_LIFETIME_MS;
  if (expired) {
    res.status(400);
    throw new Error('That code has expired. Please request a new one.');
  }

  if (user.verificationCode !== code) {
    await recordFailedCodeAttempt(user, (u) => { u.verificationCode = undefined; });
    res.status(400);
    throw new Error('Invalid verification code');
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeSentAt = undefined;
  user.codeAttempts = 0;
  await user.save();

  res.json({
    _id: user.id,
    username: user.username,
    email: user.email,
    token: generateToken(user._id),
    message: 'Email verified successfully!'
  });
});

// @desc    Resend verification email
// @route   POST /api/users/resend-verification
// @access  Public
const resendVerificationEmailHandler = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isNonEmptyString(email)) {
    res.status(400);
    throw new Error('Please provide an email address');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error('User is already verified');
  }

  const now = new Date();
  if (user.verificationCodeSentAt && (now - user.verificationCodeSentAt) < 60000) {
    res.status(429);
    throw new Error('Please wait before requesting another code');
  }

  const newCode = randomInt(100000, 1000000).toString();
  user.verificationCode = newCode;
  user.verificationCodeSentAt = now;
  user.codeAttempts = 0;
  await user.save();

  sendVerificationEmail(email, newCode);

  res.json({ message: 'Verification code resent successfully' });
});

// @desc    Request a password reset code (sent to the account's email)
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isNonEmptyString(email)) {
    res.status(400);
    throw new Error('Please provide an email address');
  }

  const user = await User.findOne({ email });

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to check which emails are registered.
  const genericResponse = {
    message: 'If an account exists for that email, a password reset code has been sent.',
  };

  if (!user) {
    res.json(genericResponse);
    return;
  }

  const resetCode = randomInt(100000, 1000000).toString();
  user.resetPasswordCode = resetCode;
  user.resetPasswordExpires = Date.now() + CODE_LIFETIME_MS;
  user.codeAttempts = 0;
  await user.save();

  sendPasswordResetEmail(email, resetCode);

  res.json(genericResponse);
});

// @desc    Reset password using the emailed code
// @route   POST /api/users/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!isNonEmptyString(email) || !isNonEmptyString(code) || !isNonEmptyString(newPassword)) {
    res.status(400);
    throw new Error('Please provide your email, the reset code, and a new password');
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400);
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const user = await User.findOne({ email });

  if (
    !user ||
    !user.resetPasswordCode ||
    user.resetPasswordCode !== code ||
    !user.resetPasswordExpires ||
    user.resetPasswordExpires < Date.now()
  ) {
    if (user && user.resetPasswordCode) {
      await recordFailedCodeAttempt(user, (u) => {
        u.resetPasswordCode = undefined;
        u.resetPasswordExpires = undefined;
      });
    }
    res.status(400);
    throw new Error('Invalid or expired reset code');
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.resetPasswordCode = undefined;
  user.resetPasswordExpires = undefined;
  user.codeAttempts = 0;
  await user.save();

  // Log the user straight in after a successful reset, same as verifyEmail does.
  res.json({
    _id: user.id,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    friends: user.friends,
    pushToken: user.pushToken,
    token: generateToken(user._id),
    message: 'Password reset successfully!',
  });
});

// @desc    Authenticate with Google
// @route   POST /api/users/google-login
// @access  Public
const googleLogin = asyncHandler(async (req, res) => {
  // Never trust the email/profile sent by the client: anyone could POST any
  // email address. Only the Google-signed ID token is proof of identity.
  let profile;
  try {
    profile = await verifyGoogleIdToken(req.body?.idToken);
  } catch (err) {
    res.status(401);
    throw new Error('Google sign-in could not be verified. Please update the app and try again.');
  }
  const { email } = profile;
  const username = profile.name || req.body?.username || email.split('@')[0];
  const profilePicture = profile.picture;

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
      password: await bcrypt.hash(randomBytes(32).toString('hex'), 10), // Random password
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

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        if (!user.isVerified) {
          // Resend code if trying to login unverified
          const newCode = randomInt(100000, 1000000).toString();
          user.verificationCode = newCode;
          user.verificationCodeSentAt = new Date();
          user.codeAttempts = 0;
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
            banner: user.banner,
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
  const users = await User.find({ _id: { $ne: req.user._id } }).select(PUBLIC_USER_FIELDS);
  res.json(users);
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(PRIVATE_USER_EXCLUSIONS);
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
    if (typeof req.body.banner === 'string') {
      user.banner = req.body.banner;
    }

    if (req.body.password) {
      if (!isNonEmptyString(req.body.password) || req.body.password.length < MIN_PASSWORD_LENGTH) {
        res.status(400);
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
      }
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
        banner: updatedUser.banner,
        friends: updatedUser.friends,
        pushToken: updatedUser.pushToken,
        isVerified: updatedUser.isVerified,
        blockedUsers: updatedUser.blockedUsers,
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
  // Removes the user and all of their data (messages, chats, codes, history,
  // media) — see utils/deleteAccount.js.
  const result = await deleteAccount(req.user._id);

  if (result) {
    const io = req.app?.get?.('io');
    // Close any live chat connections the deleted account still has open.
    io?.in(String(req.user._id)).disconnectSockets(true);
    // Anyone with one of their direct chats open needs to leave it.
    for (const { conversationId, others } of result.closedChats) {
      for (const otherId of others) io?.to(otherId).emit('conversation_deleted', { conversationId });
    }
    res.json({ message: 'Your account and all of its data have been deleted.' });
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

  if (!isNonEmptyString(username)) {
    res.status(400);
    throw new Error('Please provide a username to search');
  }

  const users = await User.find({
    username: { $regex: escapeRegex(username), $options: 'i' },
    _id: { $ne: req.user._id },
  }).select(PUBLIC_USER_FIELDS);

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

  // Reported the same as a missing user, so nobody can tell they've been blocked.
  if (targetUser.blockedUsers.some((id) => id.equals(req.user._id))) {
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

  if (!mongoose.isValidObjectId(userIdToBlock)) {
    res.status(400);
    throw new Error('Invalid user');
  }

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

  // multer-storage-cloudinary puts the permanent hosted URL on req.file.path
  res.json({ imageUrl: req.file.path });
});

module.exports = {
    registerUser,
    loginUser,
    verifyEmail,
    resendVerificationEmailHandler,
    forgotPassword,
    resetPassword,
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
