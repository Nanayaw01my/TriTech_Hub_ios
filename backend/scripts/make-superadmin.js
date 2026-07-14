#!/usr/bin/env node
/**
 * Promote an existing user to the superadmin role.
 *
 * Usage:
 *   node backend/scripts/make-superadmin.js <email|account_number|staff_id>
 *
 * Example:
 *   node backend/scripts/make-superadmin.js Nanayawgtbank@gmail.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: node scripts/make-superadmin.js <email|account_number|staff_id>');
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
  });

  if (!user) {
    console.error(`No user found for "${identifier}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.role = 'superadmin';
  await user.save();

  console.log(`Success. ${user.email || user.account_number || user.staff_id} is now a SUPERADMIN.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
