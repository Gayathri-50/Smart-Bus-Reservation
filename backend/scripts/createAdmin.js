const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');

async function createAdmin() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busbooking';
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@busbook.com').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'Admin@12345').trim();
  const adminName = String(process.env.ADMIN_NAME || 'System Admin').trim();
  const adminPhone = String(process.env.ADMIN_PHONE || '9999999999').trim();

  console.log('----------------------------------------------------');
  console.log('🔐 Smart Bus Reservation - Admin Bootstrap Script');
  console.log('----------------------------------------------------');
  console.log(`Connecting to database at ${mongoUri}...`);

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      if (existingAdmin.role === 'ADMIN' || existingAdmin.role === 'admin') {
        console.log(`ℹ️  Admin already exists: ${adminEmail}`);
        console.log('🔒 Password preserved. Existing credentials were not modified.');
        if (!existingAdmin.isActive) {
          existingAdmin.isActive = true;
          await existingAdmin.save();
          console.log('   Re-activated suspended admin account.');
        }
      } else {
        existingAdmin.role = 'ADMIN';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log(`🔄 Upgraded existing user ${adminEmail} to ADMIN role.`);
      }
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        phone: adminPhone,
        role: 'ADMIN',
        isActive: true,
      });

      await AuditLog.create({
        action: 'BOOTSTRAP_ADMIN',
        performedBy: {
          id: newAdmin._id,
          name: newAdmin.name,
          email: newAdmin.email,
          role: 'ADMIN',
        },
        targetType: 'USER',
        targetId: String(newAdmin._id),
        details: { message: 'Initial Admin provisioned via scripts/createAdmin.js' },
      });

      console.log('\n🎉 SUCCESS! Admin account created.');
      console.log(`👤 Name:     ${adminName}`);
      console.log(`📧 Email:    ${adminEmail}`);
      console.log(`🛡️  Role:     ADMIN`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Admin bootstrap failed:', err.message);
    process.exit(1);
  }
}

createAdmin();
