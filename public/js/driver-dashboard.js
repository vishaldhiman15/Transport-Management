// Driver Dashboard JavaScript

// State
const state = {
    user: null,
    driver: null,
    token: null,
    location: null,
    isOnline: false,
    currentBooking: null,
    socket: null,
    locationWatcher: null
};

// API Base
const API_URL = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSocket();
    setupEventListeners();
    loadDashboard();
    startLocationTracking();
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const driver = localStorage.getItem('driver');
    
    if (!token || !user) {
        window.location.href = '/';
        return;
    }
    
    state.token = token;
    state.user = JSON.parse(user);
    
    // Check if driver role
    if (state.user.role !== 'driver') {
        window.location.href = `/${state.user.role}/dashboard.html`;
        return;
    }
    
    if (driver) {
        state.driver = JSON.parse(driver);
    }
    
    // Update UI
    updateUserUI();
}

// Update user UI
function updateUserUI() {
    document.getElementById('userName').textContent = state.user.name;
    document.getElementById('profileName').textContent = state.user.name;
    document.getElementById('profileEmail').textContent = state.user.email;
    document.getElementById('profileNameInput').value = state.user.name;
    document.getElementById('profilePhone').value = state.user.phone || '';
    
    if (state.user.profileImage) {
        document.getElementById('userAvatar').src = state.user.profileImage;
        document.getElementById('profileAvatar').src = state.user.profileImage;
    }
    
    if (state.driver) {
        updateDriverUI();
    }
}

// Update driver UI
function updateDriverUI() {
    const driver = state.driver;
    
    // Approval status
    const approvalStatus = document.getElementById('approvalStatus');
    if (driver.isApproved) {
        approvalStatus.innerHTML = '<i class="fas fa-check-circle" style="color: var(--secondary);"></i> <span>Approved</span>';
        approvalStatus.style.color = 'var(--secondary)';
    } else {
        approvalStatus.innerHTML = '<i class="fas fa-clock" style="color: var(--warning);"></i> <span>Pending Approval</span>';
        approvalStatus.style.color = 'var(--warning)';
    }
    
    // Vehicle details
    document.getElementById('vehicleType').textContent = capitalize(driver.vehicleType);
    document.getElementById('vehicleNumber').textContent = driver.vehicleNumber;
    document.getElementById('vehicleModel').textContent = driver.vehicleModel;
    document.getElementById('vehicleColor').textContent = driver.vehicleColor;
    document.getElementById('licenseNumber').textContent = driver.licenseNumber;
    
    // Rating
    document.getElementById('driverRating').textContent = driver.rating?.average?.toFixed(1) || '0.0';
    document.getElementById('profileRating').textContent = driver.rating?.average?.toFixed(1) || '0.0';
    document.getElementById('ratingCount').textContent = driver.rating?.count || 0;
    
    // Online status
    state.isOnline = driver.isOnline;
    updateOnlineStatus();
    
    // Enable toggle only if approved
    document.getElementById('onlineToggle').disabled = !driver.isApproved;
    document.getElementById('onlineToggle').checked = driver.isOnline;
}

// Initialize Socket.IO
function initSocket() {
    state.socket = io();
    
    state.socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    state.socket.on('bookingCreated', (data) => {
        if (state.isOnline && state.driver?.isApproved && !state.currentBooking) {
            if (data.vehicleType === state.driver.vehicleType) {
                showToast('New ride request!', 'info');
                loadAvailableRequests();
            }
        }
    });
    
    state.socket.on('bookingStatusChanged', (data) => {
        if (state.currentBooking && state.currentBooking._id === data.bookingId) {
            loadCurrentBooking();
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // Action buttons
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            switchSection(action);
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Online toggle
    document.getElementById('onlineToggle').addEventListener('change', toggleOnlineStatus);
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadRides(tab.dataset.status);
        });
    });
    
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    
    // OTP modal
    document.getElementById('verifyOtpBtn').addEventListener('click', verifyOtp);
    document.getElementById('cancelOtpBtn').addEventListener('click', () => {
        document.getElementById('otpModal').classList.add('hidden');
    });
    
    // Mobile menu toggle
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });
}

// Switch section
function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    document.getElementById(`${section}Section`).classList.add('active');
    
    // Load section data
    if (section === 'requests') {
        loadAvailableRequests();
    } else if (section === 'rides') {
        loadRides();
    } else if (section === 'earnings') {
        loadEarnings();
    }
}

// Start location tracking
function startLocationTracking() {
    if ('geolocation' in navigator) {
        state.locationWatcher = navigator.geolocation.watchPosition(
            (position) => {
                state.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                // Update server location if online
                if (state.isOnline) {
                    updateServerLocation();
                }
            },
            (error) => console.log('Location error:', error),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

// Update server location
async function updateServerLocation() {
    if (!state.location || !state.token) return;
    
    try {
        await apiRequest('/driver/location', 'PUT', {
            latitude: state.location.latitude,
            longitude: state.location.longitude
        });
        
        // Emit socket event
        if (state.socket && state.driver) {
            state.socket.emit('updateDriverLocation', {
                driverId: state.driver._id,
                location: state.location
            });
        }
    } catch (error) {
        console.error('Error updating location:', error);
    }
}

// Toggle online status
async function toggleOnlineStatus() {
    if (!state.driver?.isApproved) {
        showToast('Your account is pending approval', 'error');
        document.getElementById('onlineToggle').checked = false;
        return;
    }
    
    try {
        const data = await apiRequest('/driver/toggle-online', 'PUT');
        
        if (data.success) {
            state.isOnline = data.isOnline;
            state.driver.isOnline = data.isOnline;
            state.driver.isAvailable = data.isAvailable;
            localStorage.setItem('driver', JSON.stringify(state.driver));
            
            updateOnlineStatus();
            
            if (state.isOnline) {
                showToast('You are now online!', 'success');
                loadAvailableRequests();
            } else {
                showToast('You are now offline', 'info');
            }
            
            // Emit socket event
            state.socket.emit('driverAvailability', {
                driverId: state.driver._id,
                isOnline: state.isOnline
            });
        }
    } catch (error) {
        console.error('Toggle error:', error);
        document.getElementById('onlineToggle').checked = state.isOnline;
        showToast('Error changing status', 'error');
    }
}

// Update online status UI
function updateOnlineStatus() {
    const statusDot = document.getElementById('statusDot');
    const onlineStatus = document.getElementById('onlineStatus');
    const toggleInfo = document.getElementById('toggleInfo');
    
    if (state.isOnline) {
        statusDot.classList.add('online');
        statusDot.classList.remove('offline');
        onlineStatus.textContent = 'You are Online';
        toggleInfo.textContent = 'Receiving ride requests';
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        onlineStatus.textContent = 'You are Offline';
        toggleInfo.textContent = 'Go online to receive ride requests';
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        const data = await apiRequest('/driver/dashboard');
        
        if (data.success) {
            state.driver = data.driver;
            localStorage.setItem('driver', JSON.stringify(state.driver));
            
            updateDriverUI();
            
            // Update stats
            document.getElementById('todayEarnings').textContent = `₹${data.stats.todayEarnings}`;
            document.getElementById('todayRides').textContent = data.stats.todayRides;
            document.getElementById('totalRides').textContent = data.stats.completedRides;
            document.getElementById('driverRating').textContent = data.stats.rating?.toFixed(1) || '0.0';
            
            document.getElementById('totalEarnings').textContent = `₹${data.stats.totalEarnings}`;
            document.getElementById('weekEarnings').textContent = `₹${data.driver.earnings?.thisWeek || 0}`;
            document.getElementById('monthEarnings').textContent = `₹${data.driver.earnings?.thisMonth || 0}`;
            
            // Check for current booking
            if (data.currentBooking) {
                state.currentBooking = data.currentBooking;
                showCurrentRide(data.currentBooking);
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load available ride requests
async function loadAvailableRequests() {
    if (!state.isOnline) {
        document.getElementById('requestsList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>Go online to see ride requests</p>
            </div>
        `;
        document.getElementById('requestCount').textContent = '0';
        return;
    }
    
    try {
        const data = await apiRequest('/driver/available-bookings');
        
        if (data.success) {
            document.getElementById('requestCount').textContent = data.count;
            renderRideRequests(data.bookings);
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    }
}

// Render ride requests
function renderRideRequests(bookings) {
    const container = document.getElementById('requestsList');
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No ride requests available</p>
                <small>New requests will appear here</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = bookings.map(booking => `
        <div class="booking-request-card" data-id="${booking._id}">
            <div class="user-info">
                <img src="${booking.user.profileImage || '/images/default-avatar.png'}" alt="User">
                <div>
                    <h4>${booking.user.name}</h4>
                    <p>${booking.distance} km • ${booking.duration} min</p>
                </div>
            </div>
            <div class="route-info">
                <div class="route-point">
                    <div class="pickup-dot"></div>
                    <span>${booking.pickup.address}</span>
                </div>
                <div class="route-line" style="margin-left: 5px;"></div>
                <div class="route-point">
                    <div class="dropoff-dot"></div>
                    <span>${booking.dropoff.address}</span>
                </div>
            </div>
            <div class="fare-info">
                <span class="fare">₹${booking.fare.total}</span>
                <span class="payment">${capitalize(booking.paymentMethod)}</span>
            </div>
            <div class="actions">
                <button class="btn btn-danger" onclick="declineRequest('${booking._id}')">Decline</button>
                <button class="btn btn-success" onclick="acceptRequest('${booking._id}')">Accept</button>
            </div>
        </div>
    `).join('');
}

// Accept ride request
async function acceptRequest(bookingId) {
    try {
        const data = await apiRequest(`/driver/bookings/${bookingId}/accept`, 'PUT');
        
        if (data.success) {
            state.currentBooking = data.booking;
            showCurrentRide(data.booking);
            showToast('Ride accepted!', 'success');
            loadAvailableRequests();
            switchSection('home');
            
            // Emit socket event
            state.socket.emit('bookingStatusUpdate', {
                bookingId: data.booking._id,
                status: 'accepted'
            });
        } else {
            showToast(data.message || 'Could not accept ride', 'error');
        }
    } catch (error) {
        console.error('Accept error:', error);
        showToast('Error accepting ride', 'error');
    }
}

// Decline ride request
function declineRequest(bookingId) {
    // Just remove from view - don't actually decline in API
    const card = document.querySelector(`[data-id="${bookingId}"]`);
    if (card) {
        card.remove();
    }
}

// Show current ride
function showCurrentRide(booking) {
    const section = document.getElementById('currentRideSection');
    section.classList.remove('hidden');
    
    document.getElementById('passengerName').textContent = booking.user?.name || 'Passenger';
    document.getElementById('passengerPhone').textContent = booking.user?.phone || '';
    document.getElementById('passengerPhoto').src = booking.user?.profileImage || '/images/default-avatar.png';
    document.getElementById('currentPickup').textContent = booking.pickup.address;
    document.getElementById('currentDropoff').textContent = booking.dropoff.address;
    document.getElementById('currentFare').textContent = booking.fare.total;
    document.getElementById('currentDistance').textContent = booking.distance;
    
    updateRideActions(booking.status);
}

// Update ride actions based on status
function updateRideActions(status) {
    const actionsContainer = document.getElementById('rideActions');
    
    switch (status) {
        case 'accepted':
            actionsContainer.innerHTML = `
                <button class="btn btn-light" onclick="updateBookingStatus('arriving')">
                    <i class="fas fa-car"></i> I'm Arriving
                </button>
                <button class="btn btn-danger" onclick="cancelRide()">Cancel</button>
            `;
            break;
        case 'arriving':
            actionsContainer.innerHTML = `
                <button class="btn btn-light" onclick="showOtpModal()">
                    <i class="fas fa-play"></i> Start Ride
                </button>
                <button class="btn btn-danger" onclick="cancelRide()">Cancel</button>
            `;
            break;
        case 'started':
            actionsContainer.innerHTML = `
                <button class="btn btn-success" style="flex: 1;" onclick="updateBookingStatus('completed')">
                    <i class="fas fa-flag-checkered"></i> Complete Ride
                </button>
            `;
            break;
        case 'completed':
            actionsContainer.innerHTML = `
                <p style="color: white;">Ride completed! ₹${state.currentBooking?.fare?.total || 0} earned.</p>
            `;
            setTimeout(() => {
                document.getElementById('currentRideSection').classList.add('hidden');
                state.currentBooking = null;
                loadDashboard();
            }, 3000);
            break;
    }
}

// Show OTP modal
function showOtpModal() {
    document.getElementById('otpModal').classList.remove('hidden');
    document.getElementById('otpInput').value = '';
    document.getElementById('otpInput').focus();
}

// Verify OTP
async function verifyOtp() {
    const otp = document.getElementById('otpInput').value;
    
    if (!otp || otp.length !== 4) {
        showToast('Please enter valid 4-digit OTP', 'error');
        return;
    }
    
    try {
        const data = await apiRequest(`/driver/bookings/${state.currentBooking._id}/status`, 'PUT', {
            status: 'started',
            otp
        });
        
        if (data.success) {
            document.getElementById('otpModal').classList.add('hidden');
            state.currentBooking = data.booking;
            updateRideActions('started');
            showToast('Ride started!', 'success');
            
            state.socket.emit('bookingStatusUpdate', {
                bookingId: data.booking._id,
                status: 'started'
            });
        } else {
            showToast(data.message || 'Invalid OTP', 'error');
        }
    } catch (error) {
        console.error('OTP error:', error);
        showToast('Error verifying OTP', 'error');
    }
}

// Update booking status
async function updateBookingStatus(status) {
    if (!state.currentBooking) return;
    
    try {
        const data = await apiRequest(`/driver/bookings/${state.currentBooking._id}/status`, 'PUT', {
            status
        });
        
        if (data.success) {
            state.currentBooking = data.booking;
            updateRideActions(status);
            showToast(`Status updated: ${status}`, 'success');
            
            state.socket.emit('bookingStatusUpdate', {
                bookingId: data.booking._id,
                status
            });
            
            if (status === 'completed') {
                loadDashboard();
            }
        } else {
            showToast(data.message || 'Error updating status', 'error');
        }
    } catch (error) {
        console.error('Status update error:', error);
        showToast('Error updating status', 'error');
    }
}

// Cancel ride
async function cancelRide() {
    if (!state.currentBooking) return;
    
    if (!confirm('Are you sure you want to cancel this ride?')) return;
    
    try {
        await updateBookingStatus('cancelled');
        document.getElementById('currentRideSection').classList.add('hidden');
        state.currentBooking = null;
        showToast('Ride cancelled', 'info');
    } catch (error) {
        console.error('Cancel error:', error);
    }
}

// Load current booking
async function loadCurrentBooking() {
    try {
        const data = await apiRequest('/driver/current-booking');
        
        if (data.success && data.booking) {
            state.currentBooking = data.booking;
            showCurrentRide(data.booking);
        } else {
            document.getElementById('currentRideSection').classList.add('hidden');
            state.currentBooking = null;
        }
    } catch (error) {
        console.error('Error loading current booking:', error);
    }
}

// Load rides
async function loadRides(status = '') {
    try {
        const endpoint = status ? `/driver/bookings?status=${status}` : '/driver/bookings';
        const data = await apiRequest(endpoint);
        
        if (data.success) {
            renderRides(data.bookings);
        }
    } catch (error) {
        console.error('Error loading rides:', error);
    }
}

// Render rides
function renderRides(rides) {
    const container = document.getElementById('allRidesList');
    
    if (!rides || rides.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-car"></i>
                <p>No rides found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = rides.map(ride => `
        <div class="ride-card-full">
            <div class="ride-icon">${getVehicleIcon(ride.vehicleType)}</div>
            <div class="ride-details">
                <div class="ride-route">
                    <span class="pickup">${ride.pickup.address}</span>
                    <span class="arrow">→</span>
                    <span class="dropoff">${ride.dropoff.address}</span>
                </div>
                <div class="ride-meta">
                    <span><i class="fas fa-calendar"></i> ${formatDate(ride.createdAt)}</span>
                    <span><i class="fas fa-route"></i> ${ride.distance} km</span>
                    <span><i class="fas fa-user"></i> ${ride.user?.name || 'User'}</span>
                </div>
            </div>
            <span class="ride-status status-${ride.status}">${capitalize(ride.status)}</span>
            <span class="ride-fare">₹${ride.fare.total}</span>
        </div>
    `).join('');
}

// Load earnings
function loadEarnings() {
    if (!state.driver) return;
    
    document.getElementById('totalEarningsDisplay').textContent = `₹${state.driver.earnings?.total || 0}`;
    document.getElementById('todayEarningsDisplay').textContent = `₹${state.driver.earnings?.today || 0}`;
    document.getElementById('weekEarningsDisplay').textContent = `₹${state.driver.earnings?.thisWeek || 0}`;
    document.getElementById('monthEarningsDisplay').textContent = `₹${state.driver.earnings?.thisMonth || 0}`;
}

// Update profile
async function updateProfile(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        phone: formData.get('phone')
    };
    
    try {
        const result = await apiRequest('/driver/profile', 'PUT', data);
        
        if (result.success) {
            state.user = { ...state.user, ...data };
            localStorage.setItem('user', JSON.stringify(state.user));
            
            document.getElementById('userName').textContent = data.name;
            document.getElementById('profileName').textContent = data.name;
            
            showToast('Profile updated', 'success');
        } else {
            showToast(result.message || 'Update failed', 'error');
        }
    } catch (error) {
        showToast('Error updating profile', 'error');
    }
}

// Logout
function logout() {
    if (state.locationWatcher) {
        navigator.geolocation.clearWatch(state.locationWatcher);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('driver');
    window.location.href = '/';
}

// API Request helper
async function apiRequest(endpoint, method = 'GET', data = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
    };
    
    const options = { method, headers };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    return response.json();
}

// Utility functions
function getVehicleIcon(type) {
    const icons = {
        bike: '🏍️',
        auto: '🛺',
        car: '🚗',
        suv: '🚙',
        van: '🚐',
        truck: '🚚'
    };
    return icons[type] || '🚗';
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
