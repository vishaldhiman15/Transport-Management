const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');

// Get driver profile
router.get('/profile', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id })
            .populate('user', '-password');

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver profile not found'
            });
        }

        res.json({
            success: true,
            driver
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: error.message
        });
    }
});

// Update driver profile
router.put('/profile', protect, authorize('driver'), async (req, res) => {
    try {
        const { vehicleModel, vehicleColor } = req.body;
        const { name, phone } = req.body;

        // Update user info
        if (name || phone) {
            await User.findByIdAndUpdate(req.user._id, { name, phone });
        }

        // Update driver info
        const driver = await Driver.findOneAndUpdate(
            { user: req.user._id },
            { vehicleModel, vehicleColor },
            { new: true }
        ).populate('user', '-password');

        res.json({
            success: true,
            message: 'Profile updated',
            driver
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
});

// Toggle online status
router.put('/toggle-online', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });

        if (!driver.isApproved) {
            return res.status(400).json({
                success: false,
                message: 'Your account is pending approval'
            });
        }

        driver.isOnline = !driver.isOnline;
        if (!driver.isOnline) {
            driver.isAvailable = false;
        } else {
            driver.isAvailable = true;
        }
        await driver.save();

        res.json({
            success: true,
            message: driver.isOnline ? 'You are now online' : 'You are now offline',
            isOnline: driver.isOnline,
            isAvailable: driver.isAvailable
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error toggling status',
            error: error.message
        });
    }
});

// Update location
router.put('/location', protect, authorize('driver'), async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        await Driver.findOneAndUpdate(
            { user: req.user._id },
            {
                currentLocation: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                }
            }
        );

        await User.findByIdAndUpdate(req.user._id, {
            location: {
                type: 'Point',
                coordinates: [longitude, latitude],
                lastUpdated: new Date()
            }
        });

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

// Get available bookings nearby
router.get('/available-bookings', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });

        if (!driver.isOnline || !driver.isApproved) {
            return res.status(400).json({
                success: false,
                message: 'Go online to see available bookings'
            });
        }

        const bookings = await Booking.find({
            status: 'pending',
            vehicleType: driver.vehicleType,
            'pickup.location': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: driver.currentLocation.coordinates
                    },
                    $maxDistance: 10000 // 10km radius
                }
            }
        })
        .populate('user', 'name phone profileImage')
        .sort({ createdAt: -1 })
        .limit(10);

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
});

// Accept booking
router.put('/bookings/:id/accept', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });

        if (!driver.isAvailable) {
            return res.status(400).json({
                success: false,
                message: 'You are not available'
            });
        }

        const booking = await Booking.findOne({
            _id: req.params.id,
            status: 'pending'
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found or already taken'
            });
        }

        booking.driver = driver._id;
        booking.status = 'accepted';
        booking.timeline.accepted = new Date();
        booking.otp = Math.floor(1000 + Math.random() * 9000).toString();
        await booking.save();

        driver.isAvailable = false;
        await driver.save();

        await booking.populate('user', 'name phone profileImage');

        res.json({
            success: true,
            message: 'Booking accepted',
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error accepting booking',
            error: error.message
        });
    }
});

// Update booking status
router.put('/bookings/:id/status', protect, authorize('driver'), async (req, res) => {
    try {
        const { status, otp } = req.body;
        const driver = await Driver.findOne({ user: req.user._id });

        const booking = await Booking.findOne({
            _id: req.params.id,
            driver: driver._id
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Validate OTP for starting ride
        if (status === 'started' && booking.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        const validTransitions = {
            'accepted': ['arriving', 'cancelled'],
            'arriving': ['started', 'cancelled'],
            'started': ['completed']
        };

        if (!validTransitions[booking.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status transition'
            });
        }

        booking.status = status;
        booking.timeline[status] = new Date();

        if (status === 'cancelled') {
            booking.cancelledBy = 'driver';
            driver.isAvailable = true;
            driver.cancelledRides += 1;
        }

        if (status === 'completed') {
            driver.isAvailable = true;
            driver.completedRides += 1;
            driver.earnings.total += booking.fare.total;
            driver.earnings.today += booking.fare.total;
            booking.paymentStatus = 'completed';
        }

        await booking.save();
        await driver.save();

        res.json({
            success: true,
            message: `Booking ${status}`,
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating booking',
            error: error.message
        });
    }
});

// Get driver's booking history
router.get('/bookings', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });
        const { status, page = 1, limit = 10 } = req.query;

        const query = { driver: driver._id };
        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate('user', 'name phone profileImage')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Booking.countDocuments(query);

        res.json({
            success: true,
            bookings,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
});

// Get current active booking
router.get('/current-booking', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });

        const booking = await Booking.findOne({
            driver: driver._id,
            status: { $in: ['accepted', 'arriving', 'started'] }
        }).populate('user', 'name phone profileImage');

        res.json({
            success: true,
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching current booking',
            error: error.message
        });
    }
});

// Get driver dashboard stats
router.get('/dashboard', protect, authorize('driver'), async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id })
            .populate('user', '-password');

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayBookings = await Booking.find({
            driver: driver._id,
            status: 'completed',
            'timeline.completed': { $gte: todayStart }
        });

        const todayEarnings = todayBookings.reduce((sum, b) => sum + b.fare.total, 0);
        const todayRides = todayBookings.length;

        const currentBooking = await Booking.findOne({
            driver: driver._id,
            status: { $in: ['accepted', 'arriving', 'started'] }
        }).populate('user', 'name phone profileImage');

        res.json({
            success: true,
            driver,
            stats: {
                todayEarnings,
                todayRides,
                totalEarnings: driver.earnings.total,
                completedRides: driver.completedRides,
                rating: driver.rating.average,
                totalRatings: driver.rating.count
            },
            currentBooking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard',
            error: error.message
        });
    }
});

module.exports = router;
