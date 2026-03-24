const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const { protect, authorize } = require('../middleware/auth');

// Get user profile
router.get('/profile', protect, authorize('user'), async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: error.message
        });
    }
});

// Update user profile
router.put('/profile', protect, authorize('user'), async (req, res) => {
    try {
        const { name, phone, profileImage } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name, phone, profileImage },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated',
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
});

// Get user's booking history
router.get('/bookings', protect, authorize('user'), async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        const query = { user: req.user._id };
        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate({
                path: 'driver',
                populate: { path: 'user', select: 'name phone profileImage' }
            })
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

// Get single booking details
router.get('/bookings/:id', protect, authorize('user'), async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id
        }).populate({
            path: 'driver',
            populate: { path: 'user', select: 'name phone profileImage' }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching booking',
            error: error.message
        });
    }
});

// Cancel booking
router.put('/bookings/:id/cancel', protect, authorize('user'), async (req, res) => {
    try {
        const { reason } = req.body;
        
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id,
            status: { $in: ['pending', 'accepted', 'arriving'] }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found or cannot be cancelled'
            });
        }

        booking.status = 'cancelled';
        booking.cancelledBy = 'user';
        booking.cancellationReason = reason;
        booking.timeline.cancelled = new Date();
        await booking.save();

        // Make driver available again
        if (booking.driver) {
            await Driver.findByIdAndUpdate(booking.driver, { isAvailable: true });
        }

        res.json({
            success: true,
            message: 'Booking cancelled',
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error cancelling booking',
            error: error.message
        });
    }
});

// Rate driver
router.post('/bookings/:id/rate', protect, authorize('user'), async (req, res) => {
    try {
        const { score, review } = req.body;
        
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id,
            status: 'completed'
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found or not completed'
            });
        }

        booking.rating.userRating = { score, review };
        await booking.save();

        // Update driver rating
        if (booking.driver) {
            const driver = await Driver.findById(booking.driver);
            const newCount = driver.rating.count + 1;
            const newAverage = ((driver.rating.average * driver.rating.count) + score) / newCount;
            
            driver.rating.average = Math.round(newAverage * 10) / 10;
            driver.rating.count = newCount;
            await driver.save();
        }

        res.json({
            success: true,
            message: 'Rating submitted',
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error submitting rating',
            error: error.message
        });
    }
});

// Get nearby drivers
router.get('/nearby-drivers', protect, authorize('user'), async (req, res) => {
    try {
        const { latitude, longitude, vehicleType, radius = 5000 } = req.query;

        const query = {
            isAvailable: true,
            isOnline: true,
            isApproved: true,
            currentLocation: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseInt(radius)
                }
            }
        };

        if (vehicleType) query.vehicleType = vehicleType;

        const drivers = await Driver.find(query)
            .populate('user', 'name phone profileImage')
            .limit(20);

        res.json({
            success: true,
            count: drivers.length,
            drivers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error finding drivers',
            error: error.message
        });
    }
});

// Get user dashboard stats
router.get('/dashboard', protect, authorize('user'), async (req, res) => {
    try {
        const totalRides = await Booking.countDocuments({ user: req.user._id });
        const completedRides = await Booking.countDocuments({ 
            user: req.user._id, 
            status: 'completed' 
        });
        const cancelledRides = await Booking.countDocuments({ 
            user: req.user._id, 
            status: 'cancelled' 
        });
        
        const totalSpent = await Booking.aggregate([
            { $match: { user: req.user._id, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$fare.total' } } }
        ]);

        const recentBookings = await Booking.find({ user: req.user._id })
            .populate({
                path: 'driver',
                populate: { path: 'user', select: 'name phone profileImage' }
            })
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            stats: {
                totalRides,
                completedRides,
                cancelledRides,
                totalSpent: totalSpent[0]?.total || 0
            },
            recentBookings
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
