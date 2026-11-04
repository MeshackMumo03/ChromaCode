const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const { isUserActive } = require('../socket');

const expo = new Expo();

// Must match MESSAGES_CHANNEL_ID in hooks/useNotifications.ts.
const ANDROID_CHANNEL_ID = 'messages';

const MAX_BODY_LENGTH = 180;

/**
 * Send a push notification to a user.
 *
 * Skipped when the recipient has the app open on screen (they see the message
 * live through the socket). An app in the background still gets the push, even
 * while its socket hasn't dropped yet.
 *
 * @param {string|ObjectId} recipientId   - Mongoose User _id of the recipient
 * @param {string}          title         - Notification title
 * @param {string}          body          - Notification body text
 * @param {object}          data          - Data payload (conversationId opens that chat on tap)
 * @param {Map}             activeSockets - userId -> sockets whose app is on screen
 * @returns {Promise<'sent'|'skipped-active'|'no-token'|'error'>}
 */
const sendPushNotification = async (recipientId, title, body, data = {}, activeSockets = new Map()) => {
  const recipientIdStr = recipientId.toString();

  if (isUserActive(activeSockets, recipientIdStr)) return 'skipped-active';

  const recipient = await User.findById(recipientId).select('pushToken').lean();
  if (!recipient?.pushToken || !Expo.isExpoPushToken(recipient.pushToken)) return 'no-token';

  const text = typeof body === 'string' ? body : '';
  const message = {
    to: recipient.pushToken,
    sound: 'default',
    title,
    body: text.length > MAX_BODY_LENGTH ? `${text.slice(0, MAX_BODY_LENGTH - 1)}…` : text,
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v == null ? v : String(v)])),
    channelId: ANDROID_CHANNEL_ID,
    priority: 'high',
  };

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message]);
    if (ticket?.status === 'error') {
      console.error(`[Notifications] Push rejected for ${recipientIdStr}:`, ticket.message);
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // The app was uninstalled or the token expired: stop sending to it.
        await User.updateOne({ _id: recipientId, pushToken: recipient.pushToken }, { $set: { pushToken: '' } });
      }
      return 'error';
    }
    return 'sent';
  } catch (error) {
    console.error('[Notifications] Error sending push notification:', error?.message || error);
    return 'error';
  }
};

module.exports = { sendPushNotification, expo };
