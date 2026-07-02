#!/usr/bin/env node
/**
 * Migration script: Encrypt all PII fields in the database
 * Run with: node backend/scripts/migrate-encrypt-pii.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { encrypt, isEncrypted } = require('../utils/encryption');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tritech');
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection failed: %s', error.message);
    process.exit(1);
  }
};

const migrateCustomers = async () => {
  try {
    const Customer = require('../models/Customer');
    const customers = await Customer.find({
      $or: [
        { phone: { $exists: true, $ne: null } },
        { ghana_card_id: { $exists: true, $ne: null } },
        { 'guarantor.phone': { $exists: true, $ne: null } },
        { 'guarantor.ghana_card_id': { $exists: true, $ne: null } },
      ],
    });

    let updated = 0;
    for (const customer of customers) {
      let changed = false;

      // Encrypt main customer phone
      if (customer.phone && !isEncrypted(customer.phone)) {
        customer.phone = encrypt(customer.phone);
        changed = true;
      }

      // Encrypt main customer ghana card
      if (customer.ghana_card_id && !isEncrypted(customer.ghana_card_id)) {
        customer.ghana_card_id = encrypt(customer.ghana_card_id);
        changed = true;
      }

      // Encrypt guarantor phone
      if (customer.guarantor?.phone && !isEncrypted(customer.guarantor.phone)) {
        customer.guarantor.phone = encrypt(customer.guarantor.phone);
        changed = true;
      }

      // Encrypt guarantor ghana card
      if (customer.guarantor?.ghana_card_id && !isEncrypted(customer.guarantor.ghana_card_id)) {
        customer.guarantor.ghana_card_id = encrypt(customer.guarantor.ghana_card_id);
        changed = true;
      }

      if (changed) {
        await customer.save();
        updated++;
      }
    }

    logger.info('[Migration] Customers encrypted: %d/%d', updated, customers.length);
    return updated;
  } catch (error) {
    logger.error('[Migration] Error encrypting customers: %s', error.message);
    return 0;
  }
};

const migrateUsers = async () => {
  try {
    const User = require('../models/User');
    const users = await User.find({
      phone: { $exists: true, $ne: null },
    });

    let updated = 0;
    for (const user of users) {
      if (user.phone && !isEncrypted(user.phone)) {
        user.phone = encrypt(user.phone);
        await user.save();
        updated++;
      }
    }

    logger.info('[Migration] Users encrypted: %d/%d', updated, users.length);
    return updated;
  } catch (error) {
    logger.error('[Migration] Error encrypting users: %s', error.message);
    return 0;
  }
};

const migratePasswordResets = async () => {
  try {
    const PasswordReset = require('../models/PasswordReset');
    const records = await PasswordReset.find({
      phone: { $exists: true, $ne: null },
    });

    let updated = 0;
    for (const record of records) {
      if (record.phone && !isEncrypted(record.phone)) {
        record.phone = encrypt(record.phone);
        await record.save();
        updated++;
      }
    }

    logger.info('[Migration] PasswordResets encrypted: %d/%d', updated, records.length);
    return updated;
  } catch (error) {
    logger.error('[Migration] Error encrypting password resets: %s', error.message);
    return 0;
  }
};

const runMigration = async () => {
  logger.info('========================================');
  logger.info('Starting PII Encryption Migration');
  logger.info('========================================');

  await connectDB();

  const start = Date.now();

  const customersEncrypted = await migrateCustomers();
  const usersEncrypted = await migrateUsers();
  const passwordResetsEncrypted = await migratePasswordResets();

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  logger.info('========================================');
  logger.info('Migration Complete!');
  logger.info('Customers: %d | Users: %d | PasswordResets: %d', customersEncrypted, usersEncrypted, passwordResetsEncrypted);
  logger.info('Duration: %s seconds', duration);
  logger.info('========================================');

  await mongoose.disconnect();
  process.exit(0);
};

runMigration().catch(err => {
  logger.error('Migration failed: %s', err.message);
  process.exit(1);
});
