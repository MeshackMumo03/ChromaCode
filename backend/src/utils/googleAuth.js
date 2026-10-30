const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();

// Client IDs whose ID tokens we accept. When the app configures
// GoogleSignin with a webClientId, both Android and iOS receive ID tokens
// whose audience is the web client ID; the iOS client ID is accepted too in
// case a build is ever configured without it.
function allowedAudiences() {
  return [
    process.env.GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean);
}

/**
 * Verifies a Google ID token (signature, expiry, issuer and audience) and
 * returns the verified profile. Throws if the token is missing or invalid.
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Google ID token');
  }
  const audience = allowedAudiences();
  if (audience.length === 0) {
    throw new Error('GOOGLE_WEB_CLIENT_ID is not configured on the server');
  }
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || payload.email_verified !== true) {
    throw new Error('Google account email is not verified');
  }
  return {
    email: payload.email.toLowerCase(),
    name: payload.name,
    picture: payload.picture,
  };
}

module.exports = { verifyGoogleIdToken, client };
