require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Load env variables if run locally
const mongoose = require('mongoose');
const Message = require('../models/Message');
const { encrypt } = require('../utils/encryption');

// Ensure KEY is present
if (!process.env.MESSAGE_ENCRYPTION_KEY || process.env.MESSAGE_ENCRYPTION_KEY.length !== 64) {
  console.error('ERROR: Missing or invalid MESSAGE_ENCRYPTION_KEY. Migration aborted.');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || process.env.DB_CONNECTION_STRING;

if (!MONGO_URI) {
  console.error('ERROR: Missing MongoDB connection string. Migration aborted.');
  process.exit(1);
}

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB. Starting migration...');

    // Find all messages that do not contain the standard AES-GCM format
    // A quick way is to find messages whose text does not match the ":" delimiter structure
    // But since it's safer to decrypt and check if it fails, we will fetch all and check format
    const messages = await Message.find({});
    console.log(`Found ${messages.length} total messages.`);

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const msg of messages) {
      if (!msg.text) {
        skippedCount++;
        continue;
      }

      const parts = msg.text.split(':');
      if (parts.length === 3 && parts[0].length === 24 && parts[1].length === 32) {
        // Looks like it's already encrypted (IV hex length 24, AuthTag hex length 32)
        skippedCount++;
        continue;
      }

      // It is plaintext, so encrypt it
      msg.text = encrypt(msg.text);
      await msg.save();
      encryptedCount++;

      if (encryptedCount % 100 === 0) {
        console.log(`Encrypted ${encryptedCount} messages so far...`);
      }
    }

    console.log('----------------------------------------------------');
    console.log(`Migration Complete.`);
    console.log(`Messages newly encrypted: ${encryptedCount}`);
    console.log(`Messages skipped (already encrypted/empty): ${skippedCount}`);
    console.log('----------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
