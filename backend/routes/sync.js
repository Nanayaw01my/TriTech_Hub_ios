const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { syncOfflineSales } = require('../controllers/syncController');

router.post('/offline-sales', authenticate, syncOfflineSales);

module.exports = router;
