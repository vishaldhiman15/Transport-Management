const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const VehicleType = require('../models/VehicleType');
const { protect, authorize } = require('../middleware/auth');

// Get fare estimate
router.post('/estimate', protect, async (req, res) => {
    try {
        const { 
            pickupLat, pickupLng, 
            dropoffLat, dropoffLng,
            vehicleType 
        } = req.body;

        // Calculate distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = (dropoffLat - pickupLat) * Math.PI / 180;
        const dLng = (dropoffLng - pickupLng) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // in km

        // Estimate duration (average speed 30 km/h in city)
        const duration = Math.ceil((distance / 30) * 60); // in minutes

        // Get vehicle type pricing or use defaults
        let pricing;
        const vehicleTypeDoc = await VehicleType.findOne({ name: vehicleType });
        
        if (vehicleTypeDoc) {
            pricing = vehicleTypeDoc;
        } else {
            // Default pricing
            const defaultPricing = {
                bike: { baseFare: 20, perKmRate: 8, perMinRate: 1, minFare: 30 },
                auto: { baseFare: 30, perKmRate: 12, perMinRate: 1.5, minFare: 40 },
                car: { baseFare: 50, perKmRate: 15, perMinRate: 2, minFare: 80 },
                suv: { baseFare: 80, perKmRate: 20, perMinRate: 2.5, minFare: 120 },
                van: { baseFare: 100, perKmRate: 25, perMinRate: 3, minFare: 150 },
                truck: { baseFare: 150, perKmRate: 35, perMinRate: 4, minFare: 250 }
            };
            pricing = defaultPricing[vehicleType] || defaultPricing.car;
        }

        const baseFare = pricing.baseFare;
        const distanceFare = Math.round(distance * pricing.perKmRate);
        const timeFare = Math.round(duration * pricing.perMinRate);
        let total = baseFare + distanceFare + timeFare;
        
        // Ensure minimum fare
        if (total < pricing.minFare) {
            total = pricing.minFare;
        }

        // Check for surge (simplified - could be based on demand)
        const activeBookings = await Booking.countDocuments({ 
            status: { $in: ['pending', 'accepted', 'arriving', 'started'] }
        });
        const availableDrivers = await Driver.countDocuments({ 
            isAvailable: true, 
            isOnline: true,
            vehicleType 
        });
        
        let surgeMultiplier = 1;
        if (availableDrivers > 0 && activeBookings / availableDrivers > 2) {
            surgeMultiplier = 1.5;
        }

        const surgeFare = surgeMultiplier > 1 ? Math.round(total * (surgeMultiplier - 1)) : 0;
        total = Math.round(total * surgeMultiplier);

        res.json({
            success: true,
            estimate: {
                distance: Math.round(distance * 100) / 100,
                duration,
                fare: {
                    baseFare,
                    distanceFare,
                    timeFare,
                    surgeFare,
                    surgeMultiplier,
                    total
                },
                vehicleType
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error calculating estimate',
            error: error.message
        });
    }
});

// Create booking
router.post('/', protect, authorize('user'), async (req, res) => {
    try {
        const {
            vehicleType,
            pickup,
            dropoff,
            distance,
            duration,
            fare,
            paymentMethod,
            scheduledTime
        } = req.body;

        const booking = await Booking.create({
            user: req.user._id,
            vehicleType,
            pickup: {
                address: pickup.address,
                location: {
                    type: 'Point',
                    coordinates: [pickup.lng, pickup.lat]
                }
            },
            dropoff: {
                address: dropoff.address,
                location: {
                    type: 'Point',
                    coordinates: [dropoff.lng, dropoff.lat]
                }
            },
            distance,
            duration,
            fare,
            paymentMethod: paymentMethod || 'cash',
            scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
            isScheduled: !!scheduledTime
        });

        await booking.populate('user', 'name phone profileImage');

        // Emit socket event for new booking
        const io = req.app.get('io');
        io.emit('newBooking', booking);

        res.status(201).json({
            success: true,
            message: 'Booking created',
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating booking',
            error: error.message
        });
    }
});

// Get booking by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'name phone profileImage')
            .populate({
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

// Track booking (real-time updates)
router.get('/:id/track', protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({
                path: 'driver',
                select: 'currentLocation vehicleNumber vehicleModel vehicleColor',
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
            tracking: {
                status: booking.status,
                driver: booking.driver,
                pickup: booking.pickup,
                dropoff: booking.dropoff,
                timeline: booking.timeline
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error tracking booking',
            error: error.message
        });
    }
});

// Get vehicle types (simple endpoint)
router.get('/vehicle-types', async (req, res) => {
    try {
        let vehicleTypes = await VehicleType.find({ isActive: true });
        
        // If no vehicle types in DB, return defaults
        if (vehicleTypes.length === 0) {
            vehicleTypes = [
                { name: 'Bike', baseFare: 15, perKm: 7, perMin: 1, minFare: 25, maxPassengers: 1, isActive: true },
                { name: 'Auto', baseFare: 25, perKm: 12, perMin: 1.5, minFare: 30, maxPassengers: 3, isActive: true },
                { name: 'Sedan', baseFare: 40, perKm: 15, perMin: 2, minFare: 80, maxPassengers: 4, isActive: true },
                { name: 'SUV', baseFare: 60, perKm: 20, perMin: 2.5, minFare: 120, maxPassengers: 6, isActive: true },
                { name: 'Premium', baseFare: 100, perKm: 30, perMin: 3, minFare: 200, maxPassengers: 4, isActive: true }
            ];
        }

        res.json(vehicleTypes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vehicle types', error: error.message });
    }
});

// Get vehicle types with pricing
router.get('/vehicle-types/list', async (req, res) => {
    try {
        let vehicleTypes = await VehicleType.find({ isActive: true });
        
        // If no vehicle types in DB, return defaults
        if (vehicleTypes.length === 0) {
            vehicleTypes = [
                { name: 'bike', displayName: 'Bike', icon: '🏍️', baseFare: 20, perKmRate: 8, perMinRate: 1, minFare: 30, maxPassengers: 1, description: 'Quick rides for one' },
                { name: 'auto', displayName: 'Auto', icon: '🛺', baseFare: 30, perKmRate: 12, perMinRate: 1.5, minFare: 40, maxPassengers: 3, description: 'Affordable three-wheeler' },
                { name: 'car', displayName: 'Car', icon: '🚗', baseFare: 50, perKmRate: 15, perMinRate: 2, minFare: 80, maxPassengers: 4, description: 'Comfortable sedan' },
                { name: 'suv', displayName: 'SUV', icon: '🚙', baseFare: 80, perKmRate: 20, perMinRate: 2.5, minFare: 120, maxPassengers: 6, description: 'Spacious SUV' },
                { name: 'van', displayName: 'Van', icon: '🚐', baseFare: 100, perKmRate: 25, perMinRate: 3, minFare: 150, maxPassengers: 10, description: 'Group travel' },
                { name: 'truck', displayName: 'Truck', icon: '🚚', baseFare: 150, perKmRate: 35, perMinRate: 4, minFare: 250, maxPassengers: 2, description: 'Goods transport' }
            ];
        }

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

// Get nearby available drivers
router.get('/nearby-drivers', protect, async (req, res) => {
    try {
        const { vehicleType, lat, lng, radius = 10 } = req.query; // radius in km
        
        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Location coordinates required'
            });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        
        // Build query for available drivers
        const query = {
            isOnline: true,
            isAvailable: true,
            isApproved: true
        };
        
        if (vehicleType) {
            query.vehicleType = { $regex: new RegExp(vehicleType, 'i') };
        }

        // Try geospatial query first
        let drivers = [];
        try {
            drivers = await Driver.find({
                ...query,
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: radius * 1000 // Convert to meters
                    }
                }
            })
            .populate('user', 'name phone avatar profileImage')
            .limit(10);
        } catch (geoError) {
            // Fallback to regular query if geo index not available
            drivers = await Driver.find(query)
                .populate('user', 'name phone avatar profileImage')
                .limit(10);
        }

        // Calculate distance and ETA for each driver
        const driversWithDistance = drivers.map(driver => {
            let distance = 0;
            let eta = 5; // Default 5 min
            
            if (driver.location && driver.location.coordinates) {
                // Calculate distance using Haversine formula
                const R = 6371; // Earth's radius in km
                const dLat = (driver.location.coordinates[1] - latitude) * Math.PI / 180;
                const dLng = (driver.location.coordinates[0] - longitude) * Math.PI / 180;
                const a = 
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(latitude * Math.PI / 180) * Math.cos(driver.location.coordinates[1] * Math.PI / 180) * 
                    Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                distance = R * c;
                
                // ETA based on distance (assuming 20 km/h average in city traffic)
                eta = Math.ceil((distance / 20) * 60);
            }
            
            return {
                _id: driver._id,
                user: driver.user,
                vehicleType: driver.vehicleType,
                vehicleNumber: driver.vehicleNumber,
                vehicleModel: driver.vehicleModel,
                vehicleColor: driver.vehicleColor,
                rating: driver.rating,
                totalRides: driver.totalRides,
                distance: Math.round(distance * 10) / 10,
                eta: Math.max(eta, 2) // Minimum 2 min
            };
        });

        res.json({
            success: true,
            drivers: driversWithDistance,
            count: driversWithDistance.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching nearby drivers',
            error: error.message
        });
    }
});

module.exports = router;
