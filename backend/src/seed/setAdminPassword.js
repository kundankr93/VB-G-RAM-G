
require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const User = require('../models/User');

async function setAdminPassword() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password.length < 12 || password.length > 128) {
    throw new Error(
      'Set a valid ADMIN_EMAIL and an ADMIN_PASSWORD of 12 to 128 characters.'
    );
  }

  await connectDatabase();

  const admin = await User.findOne({ email });

  if (!admin) {
    throw new Error(`No account found for ${email}.`);
  }

  if (admin.role !== 'admin') {
    throw new Error('The specified account is not an administrator.');
  }

  admin.passwordHash = await bcrypt.hash(password, 12);
  await admin.save();

  console.log(`Admin password updated successfully for ${email}.`);
}

setAdminPassword()
  .catch((error) => {
    console.error('Admin password update failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
