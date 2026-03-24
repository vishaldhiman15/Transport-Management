const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for default avatar
app.get('/images/default-avatar.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'images', 'default-avatar.svg'));
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_management')
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const driverRoutes = require('./routes/driver');
const adminRoutes = require('./routes/admin');
const bookingRoutes = require('./routes/booking');
const locationRoutes = require('./routes/location');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/location', locationRoutes);

// Socket.IO for real-time tracking
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Driver location update
    socket.on('updateDriverLocation', (data) => {
        io.emit('driverLocationUpdated', data);
    });

    // New booking notification
    socket.on('newBooking', (data) => {
        io.emit('bookingCreated', data);
    });

    // Booking status update
    socket.on('bookingStatusUpdate', (data) => {
        io.emit('bookingStatusChanged', data);
    });

    // Driver availability update
    socket.on('driverAvailability', (data) => {
        io.emit('driverAvailabilityChanged', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/user/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user', 'dashboard.html'));
});

app.get('/driver/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver', 'dashboard.html'));
});

app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📱 Transport Management System Started');
});
