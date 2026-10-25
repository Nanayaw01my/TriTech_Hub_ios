const express = require('express');
const rateLimit = require('express-rate-limit');
const { enroll, heartbeat, commands, ack } = require('../controllers/agentController');

const router = express.Router();

// Enrollment is sensitive (consumes a token) — keep it tight per IP.
const enrollLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many enrollment attempts. Try again later.' },
});

// Heartbeats/polls come from many devices; allow a generous ceiling.
const pollLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/enroll', enrollLimiter, enroll);
router.post('/heartbeat', pollLimiter, heartbeat);
router.get('/commands', pollLimiter, commands);
router.post('/ack', pollLimiter, ack);

module.exports = router;
