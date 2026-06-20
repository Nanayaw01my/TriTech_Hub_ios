/**
 * Auth endpoint tests — mocks MongoDB so no real DB needed.
 */
jest.mock('../models/User');
jest.mock('../models/Customer');
jest.mock('../models/AuditLog');
jest.mock('../models/TokenBlacklist');
jest.mock('../models/TempOTP');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
}));
jest.mock('../utils/email', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendAdminLoginOTPEmail: jest.fn(),
}));
jest.mock('../utils/sms', () => ({
  sendPasswordResetOTP: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const authRouter = require('../routes/auth');

const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const TempOTP = require('../models/TempOTP');
const AuditLog = require('../models/AuditLog');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('POST /api/auth/login', () => {
  it('returns 400 when password is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for unknown user', async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    TokenBlacklist.findOne = jest.fn().mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for wrong password', async () => {
    const mockUser = {
      _id: 'uid1',
      name: 'Staff User',
      email: 'staff@test.com',
      role: 'staff',
      is_active: true,
      comparePassword: jest.fn().mockResolvedValue(false),
    };
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'staff@test.com', password: 'badpass' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for deactivated account', async () => {
    const mockUser = {
      _id: 'uid2',
      name: 'Inactive',
      email: 'inactive@test.com',
      role: 'staff',
      is_active: false,
      comparePassword: jest.fn().mockResolvedValue(true),
    };
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'inactive@test.com', password: 'pass' });
    expect(res.status).toBe(403);
  });

  it('returns JWT on successful staff login', async () => {
    const mockUser = {
      _id: 'uid3',
      name: 'Staff',
      email: 'staff@test.com',
      role: 'staff',
      is_active: true,
      comparePassword: jest.fn().mockResolvedValue(true),
      generateAuthToken: jest.fn().mockReturnValue('mock.jwt.token'),
    };
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
    AuditLog.create = jest.fn().mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'staff@test.com', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('mock.jwt.token');
    expect(res.body.data.user.role).toBe('staff');
  });

  it('returns requiresOtp:true for admin login', async () => {
    const mockUser = {
      _id: 'adminId',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      is_active: true,
      comparePassword: jest.fn().mockResolvedValue(true),
    };
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
    TempOTP.deleteMany = jest.fn().mockResolvedValue({});
    TempOTP.create = jest.fn().mockResolvedValue({});

    const { sendAdminLoginOTPEmail } = require('../utils/email');
    sendAdminLoginOTPEmail.mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@test.com', password: 'adminpass' });
    expect(res.status).toBe(200);
    expect(res.body.data.requiresOtp).toBe(true);
    expect(res.body.data.userId).toBe('adminId');
    expect(res.body.data.token).toBeUndefined();
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('returns 400 when userId or otp missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid OTP', async () => {
    TempOTP.findOne = jest.fn().mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: 'adminId', otp: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('issues JWT for valid OTP', async () => {
    const mockRecord = { used: false, save: jest.fn().mockResolvedValue({}) };
    TempOTP.findOne = jest.fn().mockResolvedValue(mockRecord);

    const mockAdmin = {
      _id: 'adminId',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin',
      is_active: true,
      generateAuthToken: jest.fn().mockReturnValue('admin.jwt.token'),
    };
    User.findById = jest.fn().mockResolvedValue(mockAdmin);
    AuditLog.create = jest.fn().mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: 'adminId', otp: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('admin.jwt.token');
    expect(mockRecord.used).toBe(true);
  });
});
