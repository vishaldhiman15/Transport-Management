const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vehicleType: {
        type: String,
        enum: ['bike', 'auto', 'car', 'suv', 'van', 'truck'],
        required: true
    },
    vehicleNumber: {
        type: String,
        required: true,
        unique: true
    },
    vehicleModel: {
        type: String,
        required: true
    },
    vehicleColor: {
        type: String,
        required: true
    },
    licenseNumber: {
        type: String,
        required: true,
        unique: true
    },
    licenseExpiry: {
        type: Date,
        required: true
    },
    documents: {
        license: String,
        registration: String,
        insurance: String,
        photo: String
    },
    isAvailable: {
        type: Boolean,
        default: false
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    rating: {
        average: {
            type: Number,
            default: 0
        },
        count: {
            type: Number,
            default: 0
        }
    },
    earnings: {
        total: {
            type: Number,
            default: 0
        },
        today: {
            type: Number,
            default: 0
        },
        thisWeek: {
            type: Number,
            default: 0
        },
        thisMonth: {
            type: Number,
            default: 0
        }
    },
    completedRides: {
        type: Number,
        default: 0
    },
    cancelledRides: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for geospatial queries
driverSchema.index({ 'currentLocation': '2dsphere' });

module.exports = mongoose.model('Driver', driverSchema);
