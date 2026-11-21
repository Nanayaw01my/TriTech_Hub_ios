/**
 * Public API v1 for other systems (shop management system etc.).
 * Authenticated with an API key made in Settings → API keys.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireApiKey } = require('../middleware/apiKey');
const api = require('../utils/publicApi');

const router = express.Router();

// Up to 120 requests a minute per key.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.headers.authorization || req.headers['x-api-key'] || req.ip).slice(-24),
  message: { success: false, error: { code: 'too_many_requests', message: 'Too many requests — wait a minute.' } },
}));

router.get('/me', requireApiKey(null), api.whoAmI);
router.get('/sales', requireApiKey('sales:read'), api.listSales);
router.get('/sales/summary', requireApiKey('sales:read'), api.salesSummary);
router.get('/payments', requireApiKey('payments:read'), api.listPayments);
router.post('/payments', requireApiKey('payments:write'), api.recordPayment);
router.get('/stock', requireApiKey('stock:read'), api.listStock);

router.use((req, res) => res.status(404).json({ success: false, error: { code: 'not_found', message: 'No such API endpoint. See the API guide.' } }));

module.exports = router;
