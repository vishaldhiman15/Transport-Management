const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const { protect } = require('../middleware/auth');

// Get nearby drivers
router.get('/nearby-drivers', protect, async (req, res) => {
    try {
        const { latitude, longitude, vehicleType, radius = 5000 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Location coordinates required'
            });
        }

        const query = {
            isAvailable: true,
            isOnline: true,
            isApproved: true
        };

        if (vehicleType) {
            query.vehicleType = vehicleType;
        }

        // Use geospatial query
        const drivers = await Driver.find({
            ...query,
            currentLocation: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseInt(radius)
                }
            }
        })
        .populate('user', 'name phone profileImage')
        .limit(20);

        res.json({
            success: true,
            count: drivers.length,
            drivers: drivers.map(d => ({
                id: d._id,
                name: d.user.name,
                phone: d.user.phone,
                profileImage: d.user.profileImage,
                vehicleType: d.vehicleType,
                vehicleNumber: d.vehicleNumber,
                vehicleModel: d.vehicleModel,
                vehicleColor: d.vehicleColor,
                rating: d.rating.average,
                location: d.currentLocation.coordinates
            }))
        });
    } catch (error) {
        // Handle case where 2dsphere index doesn't exist
        if (error.code === 291) {
            return res.json({
                success: true,
                count: 0,
                drivers: [],
                message: 'Location index not available'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error finding drivers',
            error: error.message
        });
    }
});

// Geocode address (mock - in production use Google Maps API)
router.get('/geocode', async (req, res) => {
    try {
        const { address } = req.query;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Address is required'
            });
        }

        // Mock geocoding - in production, use actual geocoding API
        // This returns a random location near a default center
        const baseLat = 28.6139; // Delhi
        const baseLng = 77.2090;
        
        const randomOffset = () => (Math.random() - 0.5) * 0.1;

        res.json({
            success: true,
            location: {
                address,
                latitude: baseLat + randomOffset(),
                longitude: baseLng + randomOffset()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error geocoding address',
            error: error.message
        });
    }
});

// Reverse geocode
router.get('/reverse-geocode', async (req, res) => {
    try {
        const { latitude, longitude } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Coordinates are required'
            });
        }

        // Mock reverse geocoding - in production, use actual API
        res.json({
            success: true,
            address: {
                formatted: `Location at ${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}`,
                street: 'Main Street',
                city: 'City',
                state: 'State',
                country: 'Country',
                pincode: '110001'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error reverse geocoding',
            error: error.message
        });
    }
});

// Calculate route distance and time
router.post('/calculate-route', protect, async (req, res) => {
    try {
        const { origin, destination } = req.body;

        // Calculate distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const lat1 = origin.lat * Math.PI / 180;
        const lat2 = destination.lat * Math.PI / 180;
        const dLat = (destination.lat - origin.lat) * Math.PI / 180;
        const dLng = (destination.lng - origin.lng) * Math.PI / 180;

        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // in km

        // Estimate duration (30 km/h average city speed)
        const duration = Math.ceil((distance / 30) * 60); // in minutes

        res.json({
            success: true,
            route: {
                distance: Math.round(distance * 100) / 100,
                duration,
                origin,
                destination
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error calculating route',
            error: error.message
        });
    }
});

module.exports = router;
