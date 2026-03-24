const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
    },
    vehicleType: {
        type: String,
        enum: ['bike', 'auto', 'car', 'suv', 'van', 'truck'],
        required: true
    },
    pickup: {
        address: {
            type: String,
            required: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        }
    },
    dropoff: {
        address: {
            type: String,
            required: true
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                required: true
            }
        }
    },
    distance: {
        type: Number, // in kilometers
        required: true
    },
    duration: {
        type: Number, // estimated time in minutes
        required: true
    },
    fare: {
        baseFare: {
            type: Number,
            required: true
        },
        distanceFare: {
            type: Number,
            required: true
        },
        timeFare: {
            type: Number,
            default: 0
        },
        surgeFare: {
            type: Number,
            default: 0
        },
        discount: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            required: true
        }
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'wallet', 'upi'],
        default: 'cash'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'arriving', 'started', 'completed', 'cancelled'],
        default: 'pending'
    },
    cancelledBy: {
        type: String,
        enum: ['user', 'driver', 'admin', 'system']
    },
    cancellationReason: String,
    otp: {
        type: String
    },
    rating: {
        userRating: {
            score: Number,
            review: String
        },
        driverRating: {
            score: Number,
            review: String
        }
    },
    timeline: {
        requested: Date,
        accepted: Date,
        arriving: Date,
        started: Date,
        completed: Date,
        cancelled: Date
    },
    scheduledTime: Date,
    isScheduled: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate unique booking ID
bookingSchema.pre('save', async function(next) {
    if (this.isNew) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.bookingId = `TMS${year}${month}${day}${random}`;
        this.timeline.requested = new Date();
    }
    next();
});

// Index for geospatial queries
bookingSchema.index({ 'pickup.location': '2dsphere' });
bookingSchema.index({ 'dropoff.location': '2dsphere' });

module.exports = mongoose.model('Booking', bookingSchema);
