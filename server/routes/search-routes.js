const express = require('express');  // Library: Express: open-source Node.js web framework (MIT)
const searchController = require('../controllers/search-controller');

const router = express.Router();
router.get('/', searchController.search);

module.exports = router;