const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Driver = require('../models/Driver');
const { protect, generateToken } = require('../middleware/auth');

// Register User
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: role || 'user'
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profileImage: user.profileImage
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

// Register Driver
router.post('/register-driver', async (req, res) => {
    try {
        const { 
            name, email, password, phone,
            vehicleType, vehicleNumber, vehicleModel, vehicleColor,
            licenseNumber, licenseExpiry
        } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user with driver role
        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: 'driver'
        });

        // Create driver profile
        const driver = await Driver.create({
            user: user._id,
            vehicleType,
            vehicleNumber,
            vehicleModel,
            vehicleColor,
            licenseNumber,
            licenseExpiry: new Date(licenseExpiry)
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Driver registration successful. Pending approval.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            driver: {
                id: driver._id,
                vehicleType: driver.vehicleType,
                vehicleNumber: driver.vehicleNumber,
                isApproved: driver.isApproved
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Driver registration failed',
            error: error.message
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        const token = generateToken(user._id);

        // Get driver info if driver
        let driverInfo = null;
        if (user.role === 'driver') {
            driverInfo = await Driver.findOne({ user: user._id });
        }

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profileImage: user.profileImage
            },
            driver: driverInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// Get current user
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        let driverInfo = null;
        if (user.role === 'driver') {
            driverInfo = await Driver.findOne({ user: user._id });
        }

        res.json({
            success: true,
            user,
            driver: driverInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user data',
            error: error.message
        });
    }
});

// Logout (client-side token removal)
router.post('/logout', protect, (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Update location
router.put('/location', protect, async (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;

        await User.findByIdAndUpdate(req.user._id, {
            location: {
                type: 'Point',
                coordinates: [longitude, latitude],
                address,
                lastUpdated: new Date()
            }
        });

        // If driver, update driver location too
        if (req.user.role === 'driver') {
            await Driver.findOneAndUpdate(
                { user: req.user._id },
                {
                    currentLocation: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    }
                }
            );
        }

        res.json({
            success: true,
            message: 'Location updated'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating location',
            error: error.message
        });
    }
});

module.exports = router;
