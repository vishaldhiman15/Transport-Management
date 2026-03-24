const mongoose = require('mongoose');

const vehicleTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        default: '🚗'
    },
    baseFare: {
        type: Number,
        required: true
    },
    perKmRate: {
        type: Number,
        required: true
    },
    perMinRate: {
        type: Number,
        required: true
    },
    minFare: {
        type: Number,
        required: true
    },
    maxPassengers: {
        type: Number,
        required: true
    },
    description: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('VehicleType', vehicleTypeSchema);
