const Notification = require('../models/Notification');

/**
 * Create a notification. Never throws - a notification failure should
 * never break the request/complaint flow that triggered it.
 */
async function notify(userId, message, type = 'General', link = '') {
  try {
    if (!userId) return;
    await Notification.create({ user: userId, message, type, link });
  } catch (err) {
    console.error('Notification create failed:', err.message);
  }
}

module.exports = notify;
