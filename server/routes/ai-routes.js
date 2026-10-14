const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

router.post('/study-assistant', async (req, res) => {
  const userPrompt = typeof req.body?.userPrompt === 'string'
    ? req.body.userPrompt.trim()
    : '';

  if (!userPrompt) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  if (userPrompt.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Messages must be 2,000 characters or fewer.' });
  }
  if (!ai) {
    return res.status(503).json({ error: 'The study assistant is not configured.' });
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history
      .filter(message =>
        message &&
        (message.role === 'user' || message.role === 'model') &&
        typeof message.text === 'string' &&
        message.text.trim()
      )
      .slice(-MAX_HISTORY_MESSAGES)
      .map(message => ({
        role: message.role,
        parts: [{ text: message.text.trim().slice(0, MAX_MESSAGE_LENGTH) }],
      }))
    : [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      config: {
        systemInstruction: 'You are the helpful AI study assistant for LockedIN, a study-spot finder. Help people find suitable study spots and plan focused study sessions. Ask a brief follow-up when their needs are unclear. Be concise, friendly, and do not invent live availability or venue details. Avoid using ** or other formatting. Avoid filler text. Use paragraphs for clarity.',
      },
    });

    if (!response.text?.trim()) {
      return res.status(502).json({ error: 'The study assistant could not generate a response. Please try again.' });
    }

    return res.json({ reply: response.text });
  } catch (error) {
    console.error('Study assistant request failed:', error);
    return res.status(500).json({ error: 'Failed to generate a response. Please try again.' });
  }
});

module.exports = router;
