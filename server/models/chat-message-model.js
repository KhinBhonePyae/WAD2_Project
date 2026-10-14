const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  author: { type: String, required: true, trim: true, maxlength: 60 },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

chatMessageSchema.index({ createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema, 'chatMessages');

let messages = [];
let nextId = 1;

exports.findRecent = async (limit = 50) => {
  if (global.MOCK_MODE) {
    return [...messages]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit);
  }
  const recent = await ChatMessage.find().sort({ createdAt: -1, _id: -1 }).limit(limit);
  return recent.reverse();
};

exports.addMessage = async ({ userId, author, text }) => {
  if (global.MOCK_MODE) {
    const message = {
      _id: `chat-${nextId++}`,
      userId: String(userId),
      author,
      text,
      createdAt: new Date(),
    };
    messages.push(message);
    if (messages.length > 500) messages = messages.slice(-500);
    return message;
  }
  return ChatMessage.create({ userId, author, text });
};
