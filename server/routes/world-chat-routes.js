const express = require('express');  // Library: Express: open-source Node.js web framework (MIT)
const worldChatController = require('../controllers/world-chat-controller');
const authenticate = require('../middleware/auth-middleware');

const router = express.Router();

router.use(authenticate);
router.get('/messages', worldChatController.getMessages);
router.post('/messages', worldChatController.postMessage);

module.exports = router;
