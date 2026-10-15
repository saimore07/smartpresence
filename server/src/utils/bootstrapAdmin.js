const Admin = require('../models/Admin');

/**
 * Idempotently bootstrap the initial Administrator account.
 * Only creates the account if no account with the configured ADMIN_EMAIL exists.
 * Never resets or overwrites an existing administrator password on restart.
 */
const bootstrapAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@smartpresence.com').toLowerCase().trim();
    const adminInitialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin@123';

    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (existingAdmin) {
      // Do not overwrite existing credentials
      return { created: false, message: 'Admin account already exists.' };
    }

    // Admin model pre-save hook will hash passwordHash using bcrypt
    const newAdmin = new Admin({
      name: 'System Administrator',
      email: adminEmail,
      passwordHash: adminInitialPassword,
      role: 'admin',
      isActive: true,
    });

    await newAdmin.save();
    console.log(`🛡️  [Admin Bootstrap] Successfully provisioned initial administrator account: ${adminEmail}`);
    return { created: true, message: `Admin account provisioned for ${adminEmail}.` };
  } catch (error) {
    console.error('❌ [Admin Bootstrap Error]:', error.message);
    throw error;
  }
};

module.exports = bootstrapAdmin;
