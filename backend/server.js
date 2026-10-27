require('dotenv').config();

const Sentry = require('@sentry/node');

// Initialise Sentry before anything else (no-op if SENTRY_DSN is not set)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
}

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');
const { startScheduler } = require('./utils/scheduler');
const logger = require('./utils/logger');

// ─── APP SETUP ───────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

// Behind Render's (and most cloud hosts') load balancer, the real client IP
// arrives in the X-Forwarded-For header. Trust the first proxy hop so
// express-rate-limit can identify users by their real IP instead of treating
// every request as coming from the proxy (which would rate-limit all users as one).
app.set('trust proxy', 1);

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────

// Helmet: sets various HTTP security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// CORS: allow requests from the frontend URL
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://tritechhub.online',
      'https://www.tritechhub.online',
      'https://dandorsolar.site',
      'https://www.dandorsolar.site',
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
      // Capacitor mobile (iOS / Android WebView)
      'capacitor://localhost',
      'ionic://localhost',
      // Capacitor Android with androidScheme:'https' serves from https://localhost
      'https://localhost',
      // Capacitor Electron desktop
      'http://localhost',
    ].filter(Boolean);

    // Allow any *.onrender.com subdomain (Render deployments)
    const isRender = origin && /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin);

    if (!origin || isRender || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Global rate limit: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  skip: (req) => req.path.startsWith('/api/webhooks/'),
});
app.use(globalLimiter);

// Strict limiter for login / register: 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

// Password-reset limiter: 5 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests. Please wait an hour.' },
});

// Payment limiter: 30 requests per minute
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests. Please slow down.' },
});

// ─── REQUEST PARSING ──────────────────────────────────────────────────────────

// Parse JSON — needed for webhook signature verification (raw body access)
// We store the raw body for webhook signature verification
app.use(
  express.json({
    limit: '20mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ─── LOGGING ─────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    })
  );
}

// ─── STATIC FILES ─────────────────────────────────────────────────────────────

// Serve uploaded files (photos, documents)
const uploadsPath = path.resolve(process.env.UPLOAD_PATH || './uploads');
app.use('/uploads', express.static(uploadsPath));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Dan & Dor Solar Company Ltd. API is running.',
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    },
  });
});

// ─── DB STATUS ────────────────────────────────────────────────────────────────

app.get('/api/dbstatus', async (req, res) => {
  const mongoose = require('mongoose');
  const User = require('./models/User');
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  try {
    const userCount = await User.countDocuments();
    const admin = await User.findOne({ email: 'admin@tritech.com' }).select('email role is_active');
    const staff = await User.findOne({ email: 'staff@tritech.com' }).select('email role staff_id is_active');
    res.json({ dbState, userCount, admin, staff });
  } catch (e) {
    res.json({ dbState, error: e.message });
  }
});

// ─── FORCE RESEED (dev only) ───────────────────────────────────────────────────

app.get('/api/forceseed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Not available in production' });
  }
  const User = require('./models/User');
  try {
    await User.deleteMany({ email: { $in: ['admin@tritech.com', 'staff@tritech.com'] } });
    const salt1 = await bcrypt.genSalt(10);
    const salt2 = await bcrypt.genSalt(10);
    await User.collection.insertMany([
      {
        name: 'Dan & Dor Solar Admin',
        email: 'admin@tritech.com',
        password: await bcrypt.hash('admin123', salt1),
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Dan & Dor Solar Staff',
        email: 'staff@tritech.com',
        password: await bcrypt.hash('staff123', salt2),
        role: 'staff',
        staff_id: 'Tri001',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    res.json({ success: true, message: 'Users recreated. Login with admin@tritech.com / admin123' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── MAINTENANCE MODE ─────────────────────────────────────────────────────────

const isMaintenanceOn = async () => {
  if (process.env.MAINTENANCE_MODE === 'true') return true;
  try {
    const Settings = require('./models/Settings');
    const settings = await Settings.getSingleton();
    return settings.maintenance_mode || false;
  } catch {
    return false;
  }
};

app.get('/api/status', async (req, res) => {
  const maintenance = await isMaintenanceOn();
  return res.status(200).json({ success: true, maintenance });
});

const maintenanceGuard = async (req, res, next) => {
  const maintenance = await isMaintenanceOn();
  if (maintenance) {
    return res.status(503).json({
      success: false,
      maintenance: true,
      message: 'The system is under maintenance. Please check back soon.',
    });
  }
  next();
};

// ─── API ROUTES ───────────────────────────────────────────────────────────────

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/forgot-password-sms', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/auth/reset-password-otp', passwordResetLimiter);
app.use('/api/payment', paymentLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/staff', maintenanceGuard, require('./routes/staff'));
app.use('/api/customer', maintenanceGuard, require('./routes/customer'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/webhooks', require('./routes/webhook'));
app.use('/api/app', require('./routes/app'));
app.use('/api/agent', require('./routes/agent'));

// ─── SERVE REACT FRONTEND ─────────────────────────────────────────────────────

const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist));

// Committed public downloads (e.g. the Android lock-agent APK). Served from
// this app's own domain so the enrollment QR can point at it. Must come before
// the SPA catch-all, and sets the APK content type so Android can install it.
const downloadsPath = path.join(__dirname, 'downloads');
app.use('/downloads', express.static(downloadsPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    }
  },
}));

// Any non-API route serves index.html so React Router handles it
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────

// Sentry error handler (must come before custom error handler)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error: %s', err.message, { stack: err.stack });

  // Handle CORS errors
  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({
      success: false,
      message: 'Not allowed by CORS policy.',
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: messages,
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value: ${field} already exists.`,
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }

  // Generic error
  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── SEED DATA ────────────────────────────────────────────────────────────────

/**
 * Seed the database with default admin, staff, and sample devices on first run.
 */
const seedDatabase = async () => {
  try {
    const User = require('./models/User');
    const Device = require('./models/Device');
    const bcrypt = require('bcryptjs');

    // ── Seed Superadmin (master account) ──
    const superExists = await User.findOne({ username: 'Itteksolutions' });
    if (!superExists) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'Yaw292004', salt);
      await User.collection.insertOne({
        name: 'Ittek Solutions',
        username: 'Itteksolutions',
        email: 'itteksolutions@tritechhub.online',
        password: hashed,
        role: 'superadmin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      logger.info('Default superadmin created: username "Itteksolutions"');
    }

    // ── Seed Admin ──
    const adminExists = await User.findOne({ email: 'admin@tritech.com' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash('admin123', salt);
      await User.collection.insertOne({
        name: 'Dan & Dor Solar Admin',
        email: 'admin@tritech.com',
        password: hashed,
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      logger.info('Default admin created: admin@tritech.com / admin123');
    }

    // ── Seed Staff ──
    const staffExists = await User.findOne({ email: 'staff@tritech.com' });
    if (!staffExists) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash('staff123', salt);
      await User.collection.insertOne({
        name: 'Dan & Dor Solar Staff',
        email: 'staff@tritech.com',
        password: hashed,
        role: 'staff',
        staff_id: 'Tri001',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      logger.info('Default staff created: staff@tritech.com / staff123');
    }

    // ── Seed Sample Devices ──
    const deviceCount = await Device.countDocuments();
    if (deviceCount === 0) {
      const sampleDevices = [
        {
          model: 'iPhone 14 Pro Max 256GB Space Black',
          price: 6500,
          serial_number: 'C02XG3XKJGH5',
          udid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          imei: '352001234567890',
          lock_status: 'unlocked',
          sold_status: 'available',
        },
        {
          model: 'iPhone 14 Pro 128GB Silver',
          price: 5800,
          serial_number: 'C02YH4YLKHI6',
          udid: 'b2c3d4e5-f6a7-8901-bcde-f01234567891',
          imei: '352001234567891',
          lock_status: 'unlocked',
          sold_status: 'available',
        },
        {
          model: 'iPhone 13 256GB Midnight',
          price: 4500,
          serial_number: 'C02ZI5ZMLIJ7',
          udid: 'c3d4e5f6-a7b8-9012-cdef-012345678902',
          imei: '352001234567892',
          lock_status: 'unlocked',
          sold_status: 'available',
        },
        {
          model: 'iPhone 13 Pro Max 512GB Sierra Blue',
          price: 7200,
          serial_number: 'C02AJ6ANMJK8',
          udid: 'd4e5f6a7-b8c9-0123-def0-123456789013',
          imei: '352001234567893',
          lock_status: 'unlocked',
          sold_status: 'available',
        },
        {
          model: 'iPhone 12 128GB Product Red',
          price: 3200,
          serial_number: 'C02BK7BONKL9',
          udid: 'e5f6a7b8-c9d0-1234-ef01-234567890124',
          imei: '352001234567894',
          lock_status: 'unlocked',
          sold_status: 'available',
        },
        {
          model: 'iPhone 15 Pro 256GB Natural Titanium',
          price: 8500,
          serial_number: 'C02CL8CPOLM0',
          udid: 'f6a7b8c9-d0e1-2345-f012-345678901235',
          imei: '352001234567895',
          lock_status: 'unlocked',
          sold_status: 'available',
        },
      ];

      await Device.insertMany(sampleDevices);
      logger.info('%d sample iPhone devices seeded.', sampleDevices.length);
    }

    logger.info('Database seed complete.');
  } catch (error) {
    logger.error('Database seed error: %s', error.message);
  }
};

// ─── SERVER START ─────────────────────────────────────────────────────────────

// One-off rename: values saved under the old company name (the Settings
// business name and the default seeded account names). Only exact old defaults
// are touched, so anything the admin typed in themselves is left alone.
const migrateCompanyName = async () => {
  try {
    const Settings = require('./models/Settings');
    const User = require('./models/User');
    const s = await Settings.updateMany(
      { business_name: /^dan dorsolar company limited$/i },
      { business_name: 'Dan & Dor Solar Company Ltd.' }
    );
    const a = await User.updateMany({ name: 'Dan Dorsolar Admin' }, { name: 'Dan & Dor Solar Admin' });
    const st = await User.updateMany({ name: 'Dan Dorsolar Staff' }, { name: 'Dan & Dor Solar Staff' });
    const n = (s.modifiedCount || 0) + (a.modifiedCount || 0) + (st.modifiedCount || 0);
    if (n) logger.info('[migrate] Renamed %d record(s) to Dan & Dor Solar Company Ltd.', n);
  } catch (err) {
    logger.warn('[migrate] Company rename skipped: %s', err.message);
  }
};

// Once a real ENCRYPTION_KEY is set, move PII that was encrypted with the old
// public default key onto it. Works on the raw collections (no model hooks) and
// is idempotent: values already on the real key are skipped.
const migrateEncryptionKey = async () => {
  try {
    const { hasRealKey, reencryptLegacy } = require('./utils/encryption');
    if (!hasRealKey()) return;
    const Customer = require('./models/Customer');
    const User = require('./models/User');
    const get = (doc, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);
    let n = 0;

    const fields = ['phone', 'ghana_card_id', 'guarantor.phone', 'guarantor.ghana_card_id'];
    for await (const doc of Customer.collection.find({}, { projection: { phone: 1, ghana_card_id: 1, guarantor: 1 } })) {
      const $set = {};
      for (const f of fields) {
        const r = reencryptLegacy(get(doc, f));
        if (r) $set[f] = r;
      }
      if (Object.keys($set).length) {
        await Customer.collection.updateOne({ _id: doc._id }, { $set });
        n++;
      }
    }
    for await (const doc of User.collection.find({ phone: { $type: 'string' } }, { projection: { phone: 1 } })) {
      const r = reencryptLegacy(doc.phone);
      if (r) {
        await User.collection.updateOne({ _id: doc._id }, { $set: { phone: r } });
        n++;
      }
    }
    if (n) logger.info('[migrate] Re-encrypted %d record(s) with the new ENCRYPTION_KEY.', n);
  } catch (err) {
    logger.error('[migrate] Re-encryption failed: %s', err.message);
  }
};

// One-off: DSR commission per phone is GHS 85 (was a GHS 100 default). Moves
// DSRs still on the old default; recorded so it never re-runs and a rate the
// admin later sets deliberately is left alone.
const migrateCommission85 = async () => {
  try {
    const Settings = require('./models/Settings');
    const User = require('./models/User');
    const s = await Settings.getSingleton();
    if ((s.applied_migrations || []).includes('commission_85')) return;
    const r = await User.updateMany(
      { role: 'staff', $or: [{ commission_per_sale: 100 }, { commission_per_sale: { $exists: false } }] },
      { $set: { commission_per_sale: 85 } }
    );
    await Settings.updateOne({ _id: s._id }, { $addToSet: { applied_migrations: 'commission_85' } });
    logger.info('[migrate] DSR commission set to GHS 85 for %d staff.', r.modifiedCount || 0);
  } catch (err) {
    logger.warn('[migrate] Commission 85 skipped: %s', err.message);
  }
};

const startServer = async () => {
  // Bind port FIRST so Render sees the service as alive
  app.listen(PORT, () => {
    logger.info('Dan & Dor Solar Company Ltd. API — port %d — env: %s', PORT, process.env.NODE_ENV || 'development');
  });

  // Then connect to MongoDB (retries in background)
  try {
    await connectDB();
    await seedDatabase();
    await migrateCompanyName();
    await migrateEncryptionKey();
    await migrateCommission85();
    startScheduler();
  } catch (error) {
    logger.error('MongoDB init failed: %s', error.message);
  }
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection: %s', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception: %s', error.message, { stack: error.stack });
  process.exit(1);
});

process.on('SIGTERM', () => { logger.info('SIGTERM received. Shutting down.'); process.exit(0); });
process.on('SIGINT', () => { logger.info('SIGINT received. Shutting down.'); process.exit(0); });

startServer();

module.exports = app; // Export for testing
