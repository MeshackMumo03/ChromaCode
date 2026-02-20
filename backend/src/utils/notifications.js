const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

let expo = new Expo();

const sendPushNotification = async (recipientId, title, body, data = {}) => {
  const recipient = await User.findById(recipientId);
  
  if (!recipient || !recipient.pushToken) {
    console.log(`No push token for user ${recipientId}`);
    return;
  }

  if (!Expo.isExpoPushToken(recipient.pushToken)) {
    console.error(`Push token ${recipient.pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [{
    to: recipient.pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
    console.log('Push notification sent successfully');
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

module.exports = { sendPushNotification };
