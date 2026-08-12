const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

let expo = new Expo();

/**
 * Send a push notification to a user.
 * 
 * Security & UX rule: If the recipient has an active socket connection
 * (i.e. the app is currently open and in the foreground on their device),
 * we skip the push notification entirely — they already receive the message
 * in real-time via the socket 'new_message' event.
 * This also prevents the case where a user is logged into an account on
 * the same device they are sending from and receiving spurious notifications.
 *
 * @param {string|ObjectId} recipientId  - Mongoose User _id of the recipient
 * @param {string}          title        - Notification title
 * @param {string}          body         - Notification body text
 * @param {object}          data         - Optional data payload for the app
 * @param {Map}             connectedUsers - Map of userId -> socketId for online users
 */
const sendPushNotification = async (recipientId, title, body, data = {}, connectedUsers = new Map()) => {
  const recipientIdStr = recipientId.toString();

  // ── Online-presence check ──────────────────────────────────────────────────
  // If the user is actively connected via socket (app is open and in the
  // foreground), they already get the real-time message. Skip push to avoid
  // double-notification and to prevent cross-account notification leakage.
  if (connectedUsers.has(recipientIdStr)) {
    console.log(`[Notifications] Skipping push for user ${recipientIdStr} — they are online.`);
    return;
  }

  // ── Fetch recipient & token validation ────────────────────────────────────
  const recipient = await User.findById(recipientId).select('pushToken').lean();

  if (!recipient || !recipient.pushToken) {
    console.log(`[Notifications] No push token for user ${recipientIdStr}`);
    return;
  }

  if (!Expo.isExpoPushToken(recipient.pushToken)) {
    console.error(`[Notifications] Invalid Expo push token for user ${recipientIdStr}: ${recipient.pushToken}`);
    return;
  }

  // ── Build & send the notification ─────────────────────────────────────────
  const messages = [{
    to: recipient.pushToken,
    sound: 'default',
    title,
    body: body || '',
    data,
    // Collapse key prevents notification spam if multiple messages arrive
    // while the app is backgrounded.
    channelId: 'default',
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        // Log any errors returned from Expo's push service
        tickets.forEach(ticket => {
          if (ticket.status === 'error') {
            console.error(`[Notifications] Push ticket error for ${recipientIdStr}:`, ticket.message);
            if (ticket.details?.error === 'DeviceNotRegistered') {
              // Optionally: clear the stale token from DB here
              console.warn(`[Notifications] DeviceNotRegistered for ${recipientIdStr} — consider clearing pushToken.`);
            }
          }
        });
      } catch (error) {
        console.error('[Notifications] Error sending push notification chunk:', error);
      }
    }
    console.log(`[Notifications] Push notification sent to user ${recipientIdStr}`);
  } catch (error) {
    console.error('[Notifications] Error preparing push notification:', error);
  }
};

module.exports = { sendPushNotification };
