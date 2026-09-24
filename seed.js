// Seed Data Script
// Run with: node seed.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import Models
const User = require('./models/User');
const Driver = require('./models/Driver');
const VehicleType = require('./models/VehicleType');
const Booking = require('./models/Booking');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/transport-management';

// Default vehicle types
const vehicleTypes = [
    {
        name: 'bike',
        displayName: 'Bike',
        description: 'Quick rides for short distances',
        icon: '🏍️',
        baseFare: 20,
        perKmRate: 8,
        perMinRate: 1,
        minFare: 30,
        maxPassengers: 1,
        isActive: true
    },
    {
        name: 'auto',
        displayName: 'Auto',
        description: 'Affordable three-wheeler rides',
        icon: '🛺',
        baseFare: 30,
        perKmRate: 12,
        perMinRate: 1.5,
        minFare: 40,
        maxPassengers: 3,
        isActive: true
    },
    {
        name: 'sedan',
        displayName: 'Sedan',
        description: 'Comfortable sedan cars',
        icon: '🚗',
        baseFare: 50,
        perKmRate: 15,
        perMinRate: 2,
        minFare: 80,
        maxPassengers: 4,
        isActive: true
    },
    {
        name: 'suv',
        displayName: 'SUV',
        description: 'Spacious SUVs for groups',
        icon: '🚙',
        baseFare: 80,
        perKmRate: 20,
        perMinRate: 2.5,
        minFare: 120,
        maxPassengers: 6,
        isActive: true
    },
    {
        name: 'premium',
        displayName: 'Premium',
        description: 'Luxury rides for special occasions',
        icon: '✨',
        baseFare: 100,
        perKmRate: 30,
        perMinRate: 3,
        minFare: 200,
        maxPassengers: 4,
        isActive: true
    }
];

// Default users
const users = [
    {
        name: 'Admin User',
        email: 'admin@transportpro.com',
        password: 'admin123',
        phone: '9999999999',
        role: 'admin',
        isActive: true
    },
    {
        name: 'Test User',
        email: 'user@test.com',
        password: 'user123',
        phone: '9876543210',
        role: 'user',
        isActive: true
    },
    {
        name: 'Driver One',
        email: 'driver1@test.com',
        password: 'driver123',
        phone: '9876543211',
        role: 'driver',
        isActive: true
    },
    {
        name: 'Driver Two',
        email: 'driver2@test.com',
        password: 'driver123',
        phone: '9876543212',
        role: 'driver',
        isActive: true
    }
];

// Default drivers (will be linked to driver users)
const drivers = [
    {
        vehicleType: 'car',
        vehicleNumber: 'MH12AB1234',
        vehicleModel: 'Honda City',
        vehicleColor: 'White',
        licenseNumber: 'MH1234567890',
        licenseExpiry: new Date(Date.now() + 365*24*60*60*1000),
        isApproved: true,
        isOnline: true,
        isAvailable: true,
        rating: { average: 4.5, count: 150 },
        currentLocation: {
            type: 'Point',
            coordinates: [72.8777, 19.0760]
        }
    },
    {
        vehicleType: 'bike',
        vehicleNumber: 'MH12CD5678',
        vehicleModel: 'Bajaj Pulsar',
        vehicleColor: 'Black',
        licenseNumber: 'MH9876543210',
        licenseExpiry: new Date(Date.now() + 365*24*60*60*1000),
        isApproved: true,
        isOnline: false,
        isAvailable: true,
        rating: { average: 4.8, count: 320 },
        currentLocation: {
            type: 'Point',
            coordinates: [72.8900, 19.0800]
        }
    }
];

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✓ Connected to MongoDB');

        // Clear existing data (optional - comment out if you want to keep existing data)
        console.log('Clearing existing data...');
        await VehicleType.deleteMany({});
        await User.deleteMany({});
        await Driver.deleteMany({});
        await Booking.deleteMany({});
        console.log('✓ Cleared existing data');

        // Seed Vehicle Types
        console.log('\nSeeding vehicle types...');
        const createdVehicleTypes = await VehicleType.insertMany(vehicleTypes);
        console.log(`✓ Created ${createdVehicleTypes.length} vehicle types`);

        // Seed Users
        console.log('\nSeeding users...');
        const createdUsers = [];
        for (const userData of users) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const user = await User.create({
                ...userData,
                password: hashedPassword
            });
            createdUsers.push(user);
            console.log(`  ✓ Created user: ${user.email} (${user.role})`);
        }

        // Get driver users
        const driverUsers = createdUsers.filter(u => u.role === 'driver');

        // Seed Drivers
        console.log('\nSeeding driver profiles...');
        for (let i = 0; i < driverUsers.length && i < drivers.length; i++) {
            const driver = await Driver.create({
                ...drivers[i],
                user: driverUsers[i]._id
            });
            console.log(`  ✓ Created driver profile for: ${driverUsers[i].name}`);
        }

        // Create a sample booking
        console.log('\nCreating sample booking...');
        const testUser = createdUsers.find(u => u.role === 'user');
        const testDriver = await Driver.findOne({ isApproved: true });
        
        if (testUser && testDriver) {
            const booking = await Booking.create({
                user: testUser._id,
                driver: testDriver._id,
                vehicleType: 'car',
                pickup: {
                    address: 'Bandra Station, Mumbai',
                    location: {
                        type: 'Point',
                        coordinates: [72.8397, 19.0544]
                    }
                },
                dropoff: {
                    address: 'Andheri East, Mumbai',
                    location: {
                        type: 'Point',
                        coordinates: [72.8479, 19.1136]
                    }
                },
                distance: 7.5,
                duration: 25,
                fare: {
                    baseFare: 40,
                    distanceFare: 112.5,
                    timeFare: 50,
                    total: 202
                },
                status: 'completed',
                otp: '1234',
                timeline: {
                    requested: new Date(Date.now() - 3600000),
                    accepted: new Date(Date.now() - 3500000),
                    arriving: new Date(Date.now() - 3300000),
                    started: new Date(Date.now() - 3200000),
                    completed: new Date(Date.now() - 1800000)
                }
            });
            console.log('  ✓ Created sample completed booking');
        }

        console.log('\n========================================');
        console.log('Database seeded successfully!');
        console.log('========================================\n');
        console.log('Default Login Credentials:');
        console.log('----------------------------------------');
        console.log('Admin:');
        console.log('  Email: admin@transportpro.com');
        console.log('  Password: admin123');
        console.log('----------------------------------------');
        console.log('User:');
        console.log('  Email: user@test.com');
        console.log('  Password: user123');
        console.log('----------------------------------------');
        console.log('Driver:');
        console.log('  Email: driver1@test.com');
        console.log('  Password: driver123');
        console.log('----------------------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
