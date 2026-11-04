const express = require('express');  // Library: Express: open-source Node.js web framework (MIT)
const { GoogleGenAI } = require('@google/genai');  // Library: Google Gen AI SDK: official Gemini API client (Apache-2.0)
const placeModel = require('../models/place-model');
const { summarisePlaces } = require('../utils/place-summary');

const router = express.Router();
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const ENTRY_TEXT = { free: 'free entry', purchase: 'buy a drink', pass: 'day pass or membership' };

/* One line per place so the assistant recommends real LockedIN spots
 * (and knows which are open right now) instead of guessing. */
/* Facilities the user asks for in plain words. The small model sometimes claims a place has
 * a facility it doesn't, so places without every requested facility are left out of its list. */
const FACILITY_WORDS = {
  sockets: /\b(sockets?|power|plugs?|charg(e|ing))\b/i,
  wifi: /\b(wi-?fi|internet)\b/i,
  quiet: /\b(quiet|silent|silence)\b/i,
  toilets: /\b(toilets?|restrooms?|washrooms?)\b/i,
  water: /\b(water|refill)\b/i,
};

function requestedFacilities(text) {
  return Object.keys(FACILITY_WORDS).filter(key => FACILITY_WORDS[key].test(text));
}

async function placeList(required = []) {
  const places = await summarisePlaces(await placeModel.retrieveAll());
  return places
    .filter(p => p.closureStatus !== 'permanent')
    .filter(p => required.every(f => (p.facilities || []).includes(f)))
    .map(p => [
      p.name,
      p.area,
      p.hours,
      p.openNow ? 'open now' : 'closed now',
      p.indoor ? 'indoor' : 'outdoor',
      ENTRY_TEXT[p.entry],
      'facilities: ' + ((p.facilities || []).join(', ') || 'none listed'),
      p.reviewCount ? `rated ${p.rating}` : '',
    ].filter(Boolean).join(' | '))
    .join('\n');
}

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
    // check this message and the user's recent ones, so a follow-up keeps the same needs
    const recentUserText = [userPrompt, ...history.filter(m => m.role === 'user').map(m => m.parts[0].text)].join(' ');
    const required = requestedFacilities(recentUserText);
    let places = await placeList(required);
    const filtered = required.length > 0 && places.length > 0;
    if (!filtered) places = await placeList();
    const listNote = filtered
      ? `Every place below has ${required.join(', ')}, which the user asked for.`
      : required.length
        ? `No LockedIN place has all of: ${required.join(', ')}. Say so, then suggest the closest options.`
        : '';
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      config: {
        systemInstruction: 'You are the helpful AI study assistant for LockedIN, a study-spot finder for students in Singapore. SMU means Singapore Management University, NUS the National University of Singapore and NTU Nanyang Technological University. Help people find suitable study spots and plan focused study sessions. When suggesting places, only suggest places from the LockedIN list below, by their exact name, and mention they can find them on the Browse page. If they ask for a facility (for example sockets or Wi-Fi), only suggest places whose facilities list includes it, and say so if none match. Ask a brief follow-up when their needs are unclear. Be concise, friendly, and do not invent live availability or venue details. Avoid using ** or other formatting. Avoid filler text. Use paragraphs for clarity.\n\nLockedIN places (name | area | hours | open now? | indoor/outdoor | entry | facilities | rating). A place only has the facilities written after "facilities:" on its line. ' + listNote + '\n' + places,
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
