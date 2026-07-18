const express = require('express');
const router = express.Router();
const { checkUpdate } = require('../controllers/appController');

// OTA update check — public (the app calls this before the user logs in).
router.post('/updates', checkUpdate);
router.get('/updates', checkUpdate);

module.exports = router;
