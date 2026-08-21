const crypto = require('crypto');

// The key must be exactly 32 bytes (256 bits) for AES-256
// In production, this should be set in environment variables
const ENCRYPTION_KEY = process.env.MESSAGE_ENCRYPTION_KEY;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard length for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext message using AES-256-GCM.
 * @param {string} text - The plaintext to encrypt.
 * @returns {string} - The encrypted message in the format "iv:authTag:ciphertext". Returns the original text if it's empty or encryption fails.
 */
function encrypt(text) {
  if (!text) return text;
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('MESSAGE_ENCRYPTION_KEY is missing or invalid. Cannot encrypt message.');
  }

  try {
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Combine IV, AuthTag, and Ciphertext for storage
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts an encrypted message. If it detects plaintext (no delimiters), it returns it as-is.
 * @param {string} encryptedText - The text to decrypt.
 * @returns {string} - The decrypted plaintext.
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  // If the text doesn't match the "iv:authTag:ciphertext" structure, it's already plaintext
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    return encryptedText;
  }

  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('MESSAGE_ENCRYPTION_KEY is missing or invalid. Cannot decrypt message.');
  }

  try {
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return '[Decryption Error]';
  }
}

module.exports = {
  encrypt,
  decrypt,
};
