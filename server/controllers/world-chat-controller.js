const chatMessageModel = require('../models/chat-message-model');

const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_LIMIT = 50;

function toPublicMessage(message) {
  return {
    id: String(message._id),
    author: message.author,
    text: message.text,
    createdAt: message.createdAt,
  };
}

exports.getMessages = async (req, res, next) => {
  try {
    const messages = await chatMessageModel.findRecent(MESSAGE_LIMIT);
    res.json({ messages: messages.map(toPublicMessage) });
  } catch (error) {
    next(error);
  }
};

exports.postMessage = async (req, res, next) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Write a message before sending.' });
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }

    const message = await chatMessageModel.addMessage({
      userId: req.userId,
      author: req.user.name,
      text,
    });
    res.status(201).json({ message: toPublicMessage(message) });
  } catch (error) {
    next(error);
  }
};
