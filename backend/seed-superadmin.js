const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const User = require('./src/models/User');
const AuditLog = require('./src/models/AuditLog');

async function seedSuperAdminAndManagers() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busbooking';
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@busbook.com').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'Admin@12345').trim();
  const adminName = String(process.env.ADMIN_NAME || 'Super Admin').trim();
  const adminPhone = String(process.env.ADMIN_PHONE || '9999999999').trim();

  console.log('----------------------------------------------------');
  console.log('🚀 Smart Bus Reservation - Staff Accounts Setup');
  console.log('----------------------------------------------------');
  console.log(`Connecting to MongoDB at: ${mongoUri}...`);

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.\n');

    // 1. Seed or Verify Super Admin
    console.log('--- [1] SUPER ADMIN ---');
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log(`ℹ️  Super Admin already exists: ${adminEmail}`);
        if (!existingAdmin.isActive) {
          existingAdmin.isActive = true;
          await existingAdmin.save();
          console.log('   Status restored to Active.');
        }
      } else {
        existingAdmin.role = 'admin';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log(`🔄 Upgraded user ${adminEmail} to role: 'admin'.`);
      }
    } else {
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedAdminPassword,
        phone: adminPhone,
        role: 'admin',
        isActive: true,
      });

      await AuditLog.create({
        action: 'INITIALIZE_SUPER_ADMIN',
        performedBy: {
          id: newAdmin._id,
          name: newAdmin.name,
          email: newAdmin.email,
          role: 'admin',
        },
        targetType: 'USER',
        targetId: String(newAdmin._id),
        details: { message: 'Super Admin provisioned via seed script' },
      });

      console.log(`✅ Super Admin created: ${adminEmail} (Password: ${adminPassword})`);
    }

    // 2. Seed 3 Dedicated Managers
    console.log('\n--- [2] THREE DEDICATED MANAGERS ---');
    const defaultManagers = [
      {
        name: 'Ramesh Operations',
        email: 'bus.ops@busbook.com',
        phone: '9876543210',
        role: 'bus_manager',
        password: 'Password@123',
        description: 'Bus Operations Manager (Fleet, Routes, Fares, Seats)',
      },
      {
        name: 'Priya Bookings',
        email: 'bookings@busbook.com',
        phone: '9876543211',
        role: 'booking_manager',
        password: 'Password@123',
        description: 'Booking Manager (Reservations, Cancellations, Emergency)',
      },
      {
        name: 'Anand Finance',
        email: 'finance@busbook.com',
        phone: '9876543212',
        role: 'finance_manager',
        password: 'Password@123',
        description: 'Finance Manager (Transactions, Revenue, CSV Reports)',
      },
    ];

    for (const mgr of defaultManagers) {
      const existingMgr = await User.findOne({ email: mgr.email });
      if (existingMgr) {
        console.log(`ℹ️  Manager already exists: ${mgr.name} (${mgr.email}) [${mgr.role}]`);
        if (!existingMgr.isActive) {
          existingMgr.isActive = true;
          await existingMgr.save();
          console.log(`   Restored ${mgr.name} to Active.`);
        }
      } else {
        const hashedPassword = await bcrypt.hash(mgr.password, 10);
        const newMgr = await User.create({
          name: mgr.name,
          email: mgr.email,
          phone: mgr.phone,
          role: mgr.role,
          password: hashedPassword,
          isActive: true,
        });

        await AuditLog.create({
          action: 'CREATE_MANAGER',
          performedBy: {
            name: adminName,
            email: adminEmail,
            role: 'admin',
          },
          targetType: 'MANAGER',
          targetId: String(newMgr._id),
          details: { managerEmail: mgr.email, managerRole: mgr.role, managerName: mgr.name },
        });

        console.log(`✅ Created ${mgr.description}:`);
        console.log(`   Email: ${mgr.email} | Password: ${mgr.password}`);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 4 STAFF ACCOUNTS ARE READY!');
    console.log('====================================================');
    console.log('1. Super Admin:            admin@busbook.com    / Admin@12345');
    console.log('2. Bus Operations Manager: bus.ops@busbook.com  / Password@123');
    console.log('3. Booking Manager:        bookings@busbook.com / Password@123');
    console.log('4. Finance Manager:        finance@busbook.com  / Password@123');
    console.log('====================================================');
    console.log('👉 Refresh your browser at http://localhost:5174/admin/managers');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error setting up accounts:', err.message);
    process.exit(1);
  }
}

seedSuperAdminAndManagers();
