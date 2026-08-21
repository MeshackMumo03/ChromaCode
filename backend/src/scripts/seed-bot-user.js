require('dotenv').config();
const connectDB = require('../db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedBotUser = async () => {
  try {
    await connectDB();

    const username = process.env.BOT_USERNAME || 'chromabot';
    const email = process.env.BOT_EMAIL || 'chromabot@chromacode.local';
    const password = process.env.BOT_PASSWORD || require('crypto').randomBytes(32).toString('hex');

    let botUser = await User.findOne({ username });

    if (botUser) {
      console.log(`Bot user already exists: ${botUser._id}`);
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    botUser = await User.create({
      username,
      email,
      password: hashedPassword,
      isVerified: true,
      isGoogleUser: false,
      googleId: null,
      profilePicture: '',
      banner: '',
      friends: [],
      blockedUsers: [],
    });

    console.log(`Bot user created: ${botUser._id}`);
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed bot user:', error);
    process.exit(1);
  }
};

seedBotUser();
