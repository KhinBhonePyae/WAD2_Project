const express = require('express');
const worldChatController = require('../controllers/world-chat-controller');
const authenticate = require('../middleware/auth-middleware');

const router = express.Router();

router.use(authenticate);
router.get('/messages', worldChatController.getMessages);
router.post('/messages', worldChatController.postMessage);

module.exports = router;
