const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const VehicleType = require('../models/VehicleType');
const { protect, authorize } = require('../middleware/auth');

// Middleware for admin routes
router.use(protect, authorize('admin'));

// Stats endpoint for dashboard
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalDrivers = await Driver.countDocuments();
        const activeDrivers = await Driver.countDocuments({ isOnline: true, isApproved: true });
        const pendingDrivers = await Driver.countDocuments({ isApproved: false });
        const totalBookings = await Booking.countDocuments();
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
        const pendingBookings = await Booking.countDocuments({ status: 'pending' });

        const revenueResult = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$fare.total' } } }
        ]);

        // Today's stats
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayBookings = await Booking.countDocuments({
            createdAt: { $gte: todayStart }
        });

        const todayRevenueResult = await Booking.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    createdAt: { $gte: todayStart }
                } 
            },
            { $group: { _id: null, total: { $sum: '$fare.total' } } }
        ]);

        res.json({
            totalUsers,
            totalDrivers,
            activeDrivers,
            pendingDrivers,
            totalBookings,
            completedBookings,
            cancelledBookings,
            pendingBookings,
            totalRevenue: revenueResult[0]?.total || 0,
            todayBookings,
            todayRevenue: todayRevenueResult[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats', error: error.message });
    }
});

// Dashboard stats
router.get('/dashboard', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const totalBookings = await Booking.countDocuments();
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const pendingBookings = await Booking.countDocuments({ status: 'pending' });
        const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
        
        const pendingDriverApprovals = await Driver.countDocuments({ isApproved: false });
        const activeDrivers = await Driver.countDocuments({ isOnline: true, isApproved: true });

        const totalRevenue = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$fare.total' } } }
        ]);

        // Today's stats
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayBookings = await Booking.countDocuments({
            createdAt: { $gte: todayStart }
        });

        const todayRevenue = await Booking.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    'timeline.completed': { $gte: todayStart }
                } 
            },
            { $group: { _id: null, total: { $sum: '$fare.total' } } }
        ]);

        // Recent bookings
        const recentBookings = await Booking.find()
            .populate('user', 'name email phone')
            .populate({
                path: 'driver',
                populate: { path: 'user', select: 'name email phone' }
            })
            .sort({ createdAt: -1 })
            .limit(10);

        // Recent users
        const recentUsers = await User.find({ role: 'user' })
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalDrivers,
                totalBookings,
                completedBookings,
                pendingBookings,
                cancelledBookings,
                pendingDriverApprovals,
                activeDrivers,
                totalRevenue: totalRevenue[0]?.total || 0,
                todayBookings,
                todayRevenue: todayRevenue[0]?.total || 0
            },
            recentBookings,
            recentUsers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard',
            error: error.message
        });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const { role, search, limit = 20, page = 1 } = req.query;
        
        const query = { role: role || 'user' };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

// Get single user
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let driverInfo = null;
        if (user.role === 'driver') {
            driverInfo = await Driver.findOne({ user: user._id });
        }

        const bookings = await Booking.find({ 
            $or: [{ user: user._id }, { driver: driverInfo?._id }] 
        })
        .sort({ createdAt: -1 })
        .limit(10);

        res.json({
            success: true,
            user,
            driver: driverInfo,
            bookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
});

// Update user status
router.put('/users/:id/status', async (req, res) => {
    try {
        const { isActive } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'}`,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete driver profile if exists
        if (user.role === 'driver') {
            await Driver.deleteOne({ user: user._id });
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'User deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
});

// Get all drivers
router.get('/drivers', async (req, res) => {
    try {
        const { status, online, search, limit = 20, page = 1 } = req.query;
        
        const query = {};
        if (status === 'pending') query.isApproved = false;
        if (status === 'approved') query.isApproved = true;
        if (online === 'true') query.isOnline = true;

        let drivers = await Driver.find(query)
            .populate('user', '-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * parseInt(limit))
            .limit(parseInt(limit));

        if (search) {
            drivers = drivers.filter(d => 
                d.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
                d.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
                d.vehicleNumber?.toLowerCase().includes(search.toLowerCase())
            );
        }

        res.json(drivers);
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching drivers',
            error: error.message
        });
    }
});

// Approve driver
router.put('/drivers/:id/approve', async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { isApproved: true },
            { new: true }
        ).populate('user', '-password');

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        await User.findByIdAndUpdate(driver.user._id, { isVerified: true });

        res.json({
            success: true,
            message: 'Driver approved',
            driver
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error approving driver',
            error: error.message
        });
    }
});

// Reject/Suspend driver
router.put('/drivers/:id/suspend', async (req, res) => {
    try {
        const { reason } = req.body;
        
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { isApproved: false, isOnline: false, isAvailable: false },
            { new: true }
        ).populate('user', '-password');

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        res.json({
            success: true,
            message: 'Driver suspended',
            driver
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error suspending driver',
            error: error.message
        });
    }
});

// Reject driver
router.put('/drivers/:id/reject', async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { isApproved: false },
            { new: true }
        ).populate('user', '-password');

        if (!driver) {
            return res.status(404).json({ message: 'Driver not found' });
        }

        res.json({ message: 'Driver rejected', driver });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting driver', error: error.message });
    }
});

// Get all bookings
router.get('/bookings', async (req, res) => {
    try {
        const { status, startDate, endDate, limit = 20, page = 1 } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const bookings = await Booking.find(query)
            .populate('user', 'name email phone avatar')
            .populate({
                path: 'driver',
                populate: { path: 'user', select: 'name email phone avatar' }
            })
            .sort({ createdAt: -1 })
            .skip((page - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching bookings', error: error.message });
    }
});

// Get single booking
router.get('/bookings/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'name email phone profileImage')
            .populate({
                path: 'driver',
                populate: { path: 'user', select: 'name email phone profileImage' }
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

// Cancel booking (admin)
router.put('/bookings/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;
        
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (['completed', 'cancelled'].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel this booking'
            });
        }

        booking.status = 'cancelled';
        booking.cancelledBy = 'admin';
        booking.cancellationReason = reason;
        booking.timeline.cancelled = new Date();
        await booking.save();

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

// Vehicle Types Management
router.get('/vehicle-types', async (req, res) => {
    try {
        const vehicleTypes = await VehicleType.find().sort({ name: 1 });
        res.json({
            success: true,
            vehicleTypes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching vehicle types',
            error: error.message
        });
    }
});

router.post('/vehicle-types', async (req, res) => {
    try {
        const vehicleType = await VehicleType.create(req.body);
        res.status(201).json({
            success: true,
            message: 'Vehicle type created',
            vehicleType
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating vehicle type',
            error: error.message
        });
    }
});

router.put('/vehicle-types/:id', async (req, res) => {
    try {
        const vehicleType = await VehicleType.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({
            success: true,
            message: 'Vehicle type updated',
            vehicleType
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating vehicle type',
            error: error.message
        });
    }
});

router.delete('/vehicle-types/:id', async (req, res) => {
    try {
        await VehicleType.findByIdAndDelete(req.params.id);
        res.json({
            success: true,
            message: 'Vehicle type deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting vehicle type',
            error: error.message
        });
    }
});

// Analytics
router.get('/analytics', async (req, res) => {
    try {
        const { period = '7days' } = req.query;
        
        let startDate = new Date();
        switch (period) {
            case '7days':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90days':
                startDate.setDate(startDate.getDate() - 90);
                break;
        }

        // Daily bookings
        const dailyBookings = await Booking.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    revenue: { 
                        $sum: { 
                            $cond: [{ $eq: ['$status', 'completed'] }, '$fare.total', 0] 
                        } 
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Bookings by vehicle type
        const vehicleStats = await Booking.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: '$vehicleType', count: { $sum: 1 } } }
        ]);

        // Bookings by status
        const bookingsByStatus = await Booking.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Top drivers
        const topDriversAgg = await Booking.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: startDate } } },
            { $group: { _id: '$driver', totalRides: { $sum: 1 }, earnings: { $sum: '$fare.total' } } },
            { $sort: { totalRides: -1 } },
            { $limit: 10 }
        ]);

        // Populate driver info
        const driverIds = topDriversAgg.map(d => d._id).filter(Boolean);
        const drivers = await Driver.find({ _id: { $in: driverIds } })
            .populate('user', 'name email');
        
        const topDrivers = topDriversAgg.map(td => {
            const driver = drivers.find(d => d._id.toString() === td._id?.toString());
            return {
                name: driver?.user?.name || 'Unknown',
                totalRides: td.totalRides,
                earnings: td.earnings,
                rating: driver?.rating || 0
            };
        });

        res.json({
            dailyBookings,
            vehicleStats,
            bookingsByStatus,
            topDrivers
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching analytics', error: error.message });
    }
});

// Create admin user
router.post('/create-admin', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const admin = await User.create({
            name,
            email,
            password,
            phone,
            role: 'admin',
            isVerified: true
        });

        res.status(201).json({
            success: true,
            message: 'Admin created',
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating admin',
            error: error.message
        });
    }
});

module.exports = router;
