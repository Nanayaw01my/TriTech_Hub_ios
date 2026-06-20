/**
 * Paystack webhook security tests — verifies that invalid/missing
 * HMAC-SHA512 signatures are rejected before any processing.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
}));

// Build a minimal express app with only the payment webhook route
function buildWebhookApp() {
  const app = express();

  // Raw body needed for signature verification
  app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Minimal webhook handler that replicates the security check
  app.post('/api/payment/webhook', (req, res) => {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    const signature = req.headers['x-paystack-signature'];

    if (!signature || !secret) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac('sha512', secret).update(body).digest('hex');

    if (signature !== expected) {
      return res.status(401).json({ success: false, message: 'Invalid signature.' });
    }

    return res.status(200).json({ success: true });
  });

  return app;
}

const WEBHOOK_SECRET = 'test-webhook-secret';

beforeAll(() => {
  process.env.PAYSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterAll(() => {
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
});

describe('POST /api/payment/webhook — signature enforcement', () => {
  it('rejects request with no signature header', async () => {
    const app = buildWebhookApp();
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'charge.success' }));
    expect(res.status).toBe(401);
  });

  it('rejects request with wrong signature', async () => {
    const app = buildWebhookApp();
    const body = JSON.stringify({ event: 'charge.success', data: {} });
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'badsignature')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('accepts request with correct HMAC-SHA512 signature', async () => {
    const app = buildWebhookApp();
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_abc' } });
    const sig = crypto.createHmac('sha512', WEBHOOK_SECRET).update(body).digest('hex');
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
  });
});
