#!/usr/bin/env node
/**
 * Directly set (reset) a user's password — no SMS/email needed.
 *
 * Usage:
 *   node backend/scripts/set-password.js <email|account_number|staff_id> <newPassword>
 *
 * Example:
 *   node backend/scripts/set-password.js Nanayawgtbank@gmail.com Yaws292004
 *
 * The password is hashed by the User model's pre-save hook, exactly like a
 * normal login password.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const identifier = process.argv[2];
  const newPassword = process.argv[3];

  if (!identifier || !newPassword) {
    console.error('Usage: node scripts/set-password.js <email|account_number|staff_id> <newPassword>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI env var is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const esc = identifier.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const user = await User.findOne({
    $or: [
      { email: { $regex: new RegExp(`^${esc}$`, 'i') } },
      { account_number: identifier.trim() },
      { staff_id: identifier.trim() },
    ],
  }).select('+password');

  if (!user) {
    console.error(`❌ No user found for "${identifier}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.password = newPassword;
  await user.save(); // pre-save hook hashes the password

  console.log(`✅ Password updated for ${user.email || user.account_number || user.staff_id} (role: ${user.role}).`);
  console.log('   You can now log in with the new password.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
