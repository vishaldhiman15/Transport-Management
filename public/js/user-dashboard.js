// User Dashboard JavaScript

// State
const state = {
    user: null,
    token: null,
    location: null,
    currentBooking: null,
    selectedVehicle: null,
    selectedDriver: null,
    availableDrivers: [],
    bookingData: {},
    socket: null
};

// API Base
const API_URL = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSocket();
    setupEventListeners();
    loadDashboard();
    getCurrentLocation();
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/';
        return;
    }
    
    state.token = token;
    state.user = JSON.parse(user);
    
    // Check if user role
    if (state.user.role !== 'user') {
        window.location.href = `/${state.user.role}/dashboard.html`;
        return;
    }
    
    // Update UI
    document.getElementById('userName').textContent = state.user.name;
    document.getElementById('welcomeName').textContent = state.user.name.split(' ')[0];
    document.getElementById('profileName').textContent = state.user.name;
    document.getElementById('profileEmail').textContent = state.user.email;
    document.getElementById('profileNameInput').value = state.user.name;
    document.getElementById('profileEmailInput').value = state.user.email;
    document.getElementById('profilePhone').value = state.user.phone || '';
    
    if (state.user.profileImage) {
        document.getElementById('userAvatar').src = state.user.profileImage;
        document.getElementById('profileAvatar').src = state.user.profileImage;
    }
}

// Initialize Socket.IO
function initSocket() {
    state.socket = io();
    
    state.socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    state.socket.on('bookingStatusChanged', (data) => {
        if (state.currentBooking && state.currentBooking._id === data.bookingId) {
            updateBookingStatus(data.status, data);
        }
    });
    
    state.socket.on('driverLocationUpdated', (data) => {
        if (state.currentBooking && state.currentBooking.driver === data.driverId) {
            // Update map with driver location
            console.log('Driver location:', data.location);
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
    
    // Quick search
    document.getElementById('quickSearchBtn').addEventListener('click', () => {
        const pickup = document.getElementById('quickPickup').value;
        const dropoff = document.getElementById('quickDropoff').value;
        
        if (pickup && dropoff) {
            document.getElementById('bookPickup').value = pickup;
            document.getElementById('bookDropoff').value = dropoff;
            switchSection('book');
        } else {
            switchSection('book');
        }
    });
    
    // Use current location buttons
    document.querySelectorAll('.use-current, .location-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.location) {
                const input = btn.closest('.input-group').querySelector('input');
                reverseGeocode(state.location.latitude, state.location.longitude, input);
            } else {
                showToast('Location not available', 'error');
            }
        });
    });
    
    // Get estimate button
    document.getElementById('getEstimateBtn').addEventListener('click', getFareEstimate);
    
    // Vehicle selection
    document.getElementById('vehiclesList').addEventListener('click', (e) => {
        const option = e.target.closest('.vehicle-option');
        if (option) {
            document.querySelectorAll('.vehicle-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            state.selectedVehicle = JSON.parse(option.dataset.vehicle);
            
            // Clear driver selection and fetch available drivers
            state.selectedDriver = null;
            document.getElementById('confirmVehicleBtn').disabled = true;
            fetchAvailableDrivers(state.selectedVehicle.vehicleType);
        }
    });
    
    // Driver selection
    document.getElementById('driversList').addEventListener('click', (e) => {
        const card = e.target.closest('.driver-card');
        if (card) {
            document.querySelectorAll('.driver-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedDriver = JSON.parse(card.dataset.driver);
            document.getElementById('confirmVehicleBtn').disabled = false;
        }
    });
    
    // Confirm vehicle
    document.getElementById('confirmVehicleBtn').addEventListener('click', () => {
        if (state.selectedVehicle && state.selectedDriver) {
            showBookingConfirmation();
        } else if (state.selectedVehicle) {
            showToast('Please select a driver', 'error');
        }
    });
    
    // Payment method selection
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            option.querySelector('input').checked = true;
            
            // Show/hide online payment notice
            const paymentMethod = option.querySelector('input').value;
            const notice = document.getElementById('onlinePaymentNotice');
            if (paymentMethod !== 'cash') {
                notice?.classList.remove('hidden');
            } else {
                notice?.classList.add('hidden');
            }
        });
    });
    
    // Confirm booking
    document.getElementById('confirmBookingBtn').addEventListener('click', confirmBooking);
    
    // Cancel booking
    document.getElementById('cancelBookingBtn').addEventListener('click', cancelBooking);
    
    // New booking
    document.getElementById('newBookingBtn').addEventListener('click', () => {
        resetBookingForm();
        document.querySelector('.booking-step.active').classList.remove('active');
        document.getElementById('step1').classList.add('active');
    });
    
    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const currentStep = btn.closest('.booking-step');
            const prevStep = currentStep.previousElementSibling;
            if (prevStep && prevStep.classList.contains('booking-step')) {
                currentStep.classList.remove('active');
                prevStep.classList.add('active');
            }
        });
    });
    
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
    if (section === 'rides') {
        loadRides();
    }
}

// Get current location
function getCurrentLocation() {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        state.location = JSON.parse(savedLocation);
        updateLocationDisplay();
    }
    
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                localStorage.setItem('userLocation', JSON.stringify(state.location));
                updateLocationDisplay();
                updateServerLocation();
            },
            (error) => console.log('Location error:', error)
        );
    }
}

// Update location display
async function updateLocationDisplay() {
    if (!state.location) return;
    
    try {
        const response = await fetch(`${API_URL}/location/reverse-geocode?latitude=${state.location.latitude}&longitude=${state.location.longitude}`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('currentLocation').textContent = data.address.formatted;
        }
    } catch (error) {
        document.getElementById('currentLocation').textContent = 'Location available';
    }
}

// Update server with location
async function updateServerLocation() {
    if (!state.location || !state.token) return;
    
    try {
        await apiRequest('/auth/location', 'PUT', {
            latitude: state.location.latitude,
            longitude: state.location.longitude
        });
    } catch (error) {
        console.error('Error updating location:', error);
    }
}

// Reverse geocode
async function reverseGeocode(lat, lng, inputElement) {
    try {
        const response = await fetch(`${API_URL}/location/reverse-geocode?latitude=${lat}&longitude=${lng}`);
        const data = await response.json();
        if (data.success && inputElement) {
            inputElement.value = data.address.formatted;
        }
    } catch (error) {
        console.error('Reverse geocode error:', error);
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        const data = await apiRequest('/user/dashboard');
        
        if (data.success) {
            document.getElementById('totalRides').textContent = data.stats.totalRides;
            document.getElementById('completedRides').textContent = data.stats.completedRides;
            document.getElementById('cancelledRides').textContent = data.stats.cancelledRides;
            document.getElementById('totalSpent').textContent = `₹${data.stats.totalSpent}`;
            
            renderRecentRides(data.recentBookings);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Render recent rides
function renderRecentRides(rides) {
    const container = document.getElementById('recentRidesList');
    
    if (!rides || rides.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-car"></i>
                <p>No recent rides</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = rides.slice(0, 5).map(ride => `
        <div class="ride-card">
            <div class="ride-icon">${getVehicleIcon(ride.vehicleType)}</div>
            <div class="ride-details">
                <div class="ride-route">
                    <span class="pickup">${truncate(ride.pickup.address, 25)}</span>
                    <span class="arrow">→</span>
                    <span class="dropoff">${truncate(ride.dropoff.address, 25)}</span>
                </div>
                <div class="ride-meta">
                    <span>${formatDate(ride.createdAt)}</span>
                    <span>${ride.distance} km</span>
                </div>
            </div>
            <span class="ride-status status-${ride.status}">${capitalize(ride.status)}</span>
            <span class="ride-fare">₹${ride.fare.total}</span>
        </div>
    `).join('');
}

// Load all rides
async function loadRides(status = '') {
    try {
        const endpoint = status ? `/user/bookings?status=${status}` : '/user/bookings';
        const data = await apiRequest(endpoint);
        
        if (data.success) {
            renderAllRides(data.bookings);
        }
    } catch (error) {
        console.error('Error loading rides:', error);
    }
}

// Render all rides
function renderAllRides(rides) {
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
                    <span><i class="fas fa-clock"></i> ${ride.duration} min</span>
                    ${ride.driver ? `<span><i class="fas fa-user"></i> ${ride.driver.user?.name || 'Driver'}</span>` : ''}
                </div>
            </div>
            <span class="ride-status status-${ride.status}">${capitalize(ride.status)}</span>
            <div>
                <span class="ride-fare">₹${ride.fare.total}</span>
                ${ride.status === 'completed' && !ride.rating?.userRating ? 
                    `<button class="btn btn-sm btn-primary" onclick="showRatingModal('${ride._id}')">Rate</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Get fare estimate
async function getFareEstimate() {
    const pickup = document.getElementById('bookPickup').value;
    const dropoff = document.getElementById('bookDropoff').value;
    
    if (!pickup || !dropoff) {
        showToast('Please enter pickup and drop-off locations', 'error');
        return;
    }
    
    // For demo, use mock coordinates based on location or saved location
    const pickupCoords = state.location || { latitude: 28.6139, longitude: 77.2090 };
    const dropoffCoords = {
        latitude: pickupCoords.latitude + (Math.random() - 0.5) * 0.1,
        longitude: pickupCoords.longitude + (Math.random() - 0.5) * 0.1
    };
    
    state.bookingData = {
        pickup: { address: pickup, lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        dropoff: { address: dropoff, lat: dropoffCoords.latitude, lng: dropoffCoords.longitude }
    };
    
    try {
        // Get vehicle types and estimates
        const vehicleTypes = ['bike', 'auto', 'car', 'suv', 'van', 'truck'];
        const estimates = [];
        
        for (const type of vehicleTypes) {
            const response = await apiRequest('/booking/estimate', 'POST', {
                pickupLat: pickupCoords.latitude,
                pickupLng: pickupCoords.longitude,
                dropoffLat: dropoffCoords.latitude,
                dropoffLng: dropoffCoords.longitude,
                vehicleType: type
            });
            
            if (response.success) {
                estimates.push(response.estimate);
            }
        }
        
        if (estimates.length > 0) {
            state.bookingData.distance = estimates[0].distance;
            state.bookingData.duration = estimates[0].duration;
            
            // Update UI
            document.getElementById('summaryPickup').textContent = pickup;
            document.getElementById('summaryDropoff').textContent = dropoff;
            document.getElementById('routeDistance').textContent = estimates[0].distance;
            document.getElementById('routeDuration').textContent = estimates[0].duration;
            
            renderVehicleOptions(estimates);
            
            // Go to step 2
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step2').classList.add('active');
        }
    } catch (error) {
        console.error('Error getting estimate:', error);
        showToast('Error getting fare estimate', 'error');
    }
}

// Render vehicle options
function renderVehicleOptions(estimates) {
    const container = document.getElementById('vehiclesList');
    const icons = {
        bike: '🏍️',
        auto: '🛺',
        car: '🚗',
        suv: '🚙',
        van: '🚐',
        truck: '🚚'
    };
    
    container.innerHTML = estimates.map(est => `
        <div class="vehicle-option" data-vehicle='${JSON.stringify(est)}'>
            <span class="icon">${icons[est.vehicleType] || '🚗'}</span>
            <div class="info">
                <h4>${capitalize(est.vehicleType)}</h4>
                <p>${est.duration} min away</p>
            </div>
            <div class="price">
                <div class="amount">₹${est.fare.total}</div>
                <div class="time">${est.distance} km</div>
            </div>
        </div>
    `).join('');
    
    // Hide drivers section initially
    document.getElementById('driversSection').classList.add('hidden');
}

// Fetch available drivers for selected vehicle type
async function fetchAvailableDrivers(vehicleType) {
    const driversSection = document.getElementById('driversSection');
    const driversList = document.getElementById('driversList');
    const driverCount = document.getElementById('driverCount');
    
    // Show drivers section with loading state
    driversSection.classList.remove('hidden');
    driversList.innerHTML = `
        <div class="loading-drivers">
            <div class="loader"></div>
            <p>Searching for ${vehicleType} drivers near you...</p>
        </div>
    `;
    
    try {
        // Get location for search
        const pickupCoords = state.bookingData.pickup || state.location || { lat: 28.6139, lng: 77.2090 };
        
        const response = await apiRequest(`/booking/nearby-drivers?vehicleType=${vehicleType}&lat=${pickupCoords.lat}&lng=${pickupCoords.lng}`);
        
        if (response.success && response.drivers && response.drivers.length > 0) {
            state.availableDrivers = response.drivers;
            renderAvailableDrivers(response.drivers);
            driverCount.textContent = `${response.drivers.length} drivers found`;
        } else {
            // Simulate drivers for demo if no real drivers available
            const mockDrivers = generateMockDrivers(vehicleType, state.selectedVehicle?.fare?.total || 100);
            state.availableDrivers = mockDrivers;
            renderAvailableDrivers(mockDrivers);
            driverCount.textContent = `${mockDrivers.length} drivers found`;
        }
    } catch (error) {
        console.error('Error fetching drivers:', error);
        // Generate mock drivers as fallback
        const mockDrivers = generateMockDrivers(vehicleType, state.selectedVehicle?.fare?.total || 100);
        state.availableDrivers = mockDrivers;
        renderAvailableDrivers(mockDrivers);
        driverCount.textContent = `${mockDrivers.length} drivers found`;
    }
}

// Generate mock drivers for demo
function generateMockDrivers(vehicleType, basePrice) {
    const names = [
        { name: 'Rahul Kumar', rating: 4.8, rides: 523 },
        { name: 'Amit Singh', rating: 4.6, rides: 342 },
        { name: 'Vijay Sharma', rating: 4.9, rides: 891 },
        { name: 'Pradeep Yadav', rating: 4.5, rides: 156 },
        { name: 'Suresh Verma', rating: 4.7, rides: 445 }
    ];
    
    const vehicles = {
        bike: ['Bajaj Pulsar', 'Honda Activa', 'Hero Splendor', 'TVS Apache'],
        auto: ['Bajaj Auto', 'Piaggio Ape', 'Mahindra Treo'],
        car: ['Maruti Swift', 'Hyundai i20', 'Honda City', 'Tata Nexon'],
        suv: ['Mahindra XUV500', 'Toyota Innova', 'Hyundai Creta'],
        van: ['Maruti Eeco', 'Mahindra Supro', 'Tata Winger'],
        truck: ['Tata Ace', 'Mahindra Bolero', 'Ashok Leyland']
    };
    
    const colors = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Grey'];
    
    return names.slice(0, 3 + Math.floor(Math.random() * 3)).map((driver, i) => {
        const priceVariation = Math.round((Math.random() - 0.5) * 20); // ±10 variation
        const eta = 3 + Math.floor(Math.random() * 10); // 3-12 min ETA
        const vehicleOptions = vehicles[vehicleType] || vehicles.car;
        
        return {
            _id: `driver_${i + 1}`,
            user: {
                name: driver.name,
                phone: `+91 98765432${10 + i}`,
                avatar: '/images/default-avatar.png'
            },
            vehicleType: vehicleType,
            vehicleNumber: `DL ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${1000 + Math.floor(Math.random() * 9000)}`,
            vehicleModel: vehicleOptions[Math.floor(Math.random() * vehicleOptions.length)],
            vehicleColor: colors[Math.floor(Math.random() * colors.length)],
            rating: driver.rating,
            totalRides: driver.rides,
            price: Math.max(basePrice + priceVariation, Math.round(basePrice * 0.8)), // Ensure reasonable price
            eta: eta
        };
    }).sort((a, b) => a.price - b.price); // Sort by price
}

// Render available drivers
function renderAvailableDrivers(drivers) {
    const container = document.getElementById('driversList');
    
    if (drivers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <p>No drivers available nearby</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = drivers.map(driver => `
        <div class="driver-card" data-driver='${JSON.stringify(driver)}'>
            <img class="driver-avatar" src="${driver.user?.avatar || '/images/default-avatar.png'}" alt="${driver.user?.name}">
            <div class="driver-info">
                <div class="driver-name">${driver.user?.name || 'Driver'}</div>
                <div class="driver-meta">
                    <span class="rating"><i class="fas fa-star"></i> ${driver.rating?.toFixed(1) || '4.5'}</span>
                    <span class="rides"><i class="fas fa-car"></i> ${driver.totalRides || 0} rides</span>
                </div>
                <div class="driver-vehicle">${driver.vehicleColor || ''} ${driver.vehicleModel || ''} • ${driver.vehicleNumber || ''}</div>
            </div>
            <div class="driver-price">
                <div class="price-amount">₹${driver.price || state.selectedVehicle?.fare?.total || 0}</div>
                <div class="price-eta">${driver.eta || 5} min away</div>
            </div>
        </div>
    `).join('');
}

// Show booking confirmation
function showBookingConfirmation() {
    const vehicle = state.selectedVehicle;
    const driver = state.selectedDriver;
    const booking = state.bookingData;
    
    document.getElementById('confirmPickup').textContent = booking.pickup.address;
    document.getElementById('confirmDropoff').textContent = booking.dropoff.address;
    document.getElementById('confirmVehicleIcon').textContent = getVehicleIcon(vehicle.vehicleType);
    document.getElementById('confirmVehicle').textContent = capitalize(vehicle.vehicleType);
    
    // Use driver's price if selected, otherwise vehicle fare
    const finalPrice = driver?.price || vehicle.fare.total;
    
    document.getElementById('fareBase').textContent = `₹${vehicle.fare.baseFare}`;
    document.getElementById('fareDistanceKm').textContent = vehicle.distance;
    document.getElementById('fareDistance').textContent = `₹${vehicle.fare.distanceFare}`;
    document.getElementById('fareTimeMin').textContent = vehicle.duration;
    document.getElementById('fareTime').textContent = `₹${vehicle.fare.timeFare}`;
    
    if (vehicle.fare.surgeFare > 0) {
        document.querySelector('.fare-row.surge').classList.remove('hidden');
        document.getElementById('fareSurge').textContent = `₹${vehicle.fare.surgeFare}`;
    }
    
    document.getElementById('fareTotal').textContent = `₹${finalPrice}`;
    
    // Update selected driver info
    if (driver) {
        const driverInfoSection = document.getElementById('selectedDriverInfo');
        if (driverInfoSection) {
            driverInfoSection.classList.remove('hidden');
            document.getElementById('selectedDriverPhoto').src = driver.user?.avatar || '/images/default-avatar.png';
            document.getElementById('selectedDriverName').textContent = driver.user?.name || 'Driver';
            document.getElementById('selectedDriverRating').textContent = driver.rating?.toFixed(1) || '4.5';
            document.getElementById('selectedDriverRides').textContent = driver.totalRides || 0;
            document.getElementById('selectedDriverVehicle').textContent = 
                `${driver.vehicleColor || ''} ${driver.vehicleModel || ''} • ${driver.vehicleNumber || ''}`;
        }
    }
    
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.add('active');
}

// Confirm booking
async function confirmBooking() {
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const driver = state.selectedDriver;
    const finalPrice = driver?.price || state.selectedVehicle.fare.total;
    
    const bookingPayload = {
        vehicleType: state.selectedVehicle.vehicleType,
        pickup: state.bookingData.pickup,
        dropoff: state.bookingData.dropoff,
        distance: state.selectedVehicle.distance,
        duration: state.selectedVehicle.duration,
        fare: {
            ...state.selectedVehicle.fare,
            total: finalPrice
        },
        paymentMethod,
        selectedDriver: driver?._id || null
    };
    
    try {
        const data = await apiRequest('/booking', 'POST', bookingPayload);
        
        if (data.success) {
            state.currentBooking = data.booking;
            
            document.getElementById('bookingIdDisplay').textContent = data.booking.bookingId;
            
            // Emit socket event
            state.socket.emit('newBooking', {
                bookingId: data.booking._id,
                vehicleType: data.booking.vehicleType,
                pickup: data.booking.pickup,
                selectedDriver: driver?._id
            });
            
            document.getElementById('step3').classList.remove('active');
            document.getElementById('step4').classList.add('active');
            
            showToast('Booking confirmed!', 'success');
            
            // If driver was pre-selected, show their info immediately
            if (driver) {
                setTimeout(() => {
                    updateBookingStatus('accepted', { 
                        driver: driver, 
                        otp: Math.floor(1000 + Math.random() * 9000) 
                    });
                }, 2000);
            } else {
                // Simulate driver acceptance after 5 seconds (for demo)
                setTimeout(() => simulateDriverAcceptance(), 5000);
            }
        } else {
            showToast(data.message || 'Booking failed', 'error');
        }
    } catch (error) {
        console.error('Booking error:', error);
        showToast('Booking failed', 'error');
    }
}

// Simulate driver acceptance (for demo)
function simulateDriverAcceptance() {
    if (!state.currentBooking || state.currentBooking.status !== 'pending') return;
    
    // Mock driver data
    const mockDriver = {
        user: {
            name: 'Rahul Kumar',
            phone: '+91 9876543210'
        },
        vehicleNumber: 'DL 01 AB 1234',
        vehicleModel: 'White Swift',
        rating: { average: 4.5 }
    };
    
    const otp = Math.floor(1000 + Math.random() * 9000);
    
    updateBookingStatus('accepted', { driver: mockDriver, otp });
    
    // Simulate arriving after 10 seconds
    setTimeout(() => {
        updateBookingStatus('arriving', {});
    }, 10000);
}

// Update booking status
function updateBookingStatus(status, data = {}) {
    if (!state.currentBooking) return;
    
    state.currentBooking.status = status;
    
    // Update timeline
    document.querySelectorAll('.timeline-item').forEach(item => {
        if (item.dataset.status === status) {
            item.classList.add('active');
        }
    });
    
    // Mark all previous items as active
    const statuses = ['accepted', 'arriving', 'started', 'completed'];
    const currentIndex = statuses.indexOf(status);
    statuses.forEach((s, i) => {
        if (i <= currentIndex) {
            document.querySelector(`.timeline-item[data-status="${s}"]`)?.classList.add('active');
        }
    });
    
    if (status === 'accepted' && data.driver) {
        document.getElementById('searchStatus').textContent = 'Driver assigned!';
        document.querySelector('.driver-search-status .loader').style.display = 'none';
        
        document.getElementById('driverDetails').classList.remove('hidden');
        document.getElementById('driverName').textContent = data.driver.user?.name || 'Driver';
        document.getElementById('driverRating').textContent = data.driver.rating?.average || '4.5';
        document.getElementById('vehicleDetails').textContent = data.driver.vehicleModel || 'Vehicle';
        document.getElementById('vehicleNumber').textContent = data.driver.vehicleNumber || '';
        
        if (data.otp) {
            document.getElementById('otpSection').classList.remove('hidden');
            document.getElementById('otpDisplay').textContent = data.otp;
        }
    }
    
    if (status === 'arriving') {
        document.getElementById('searchStatus').textContent = 'Driver is arriving!';
    }
    
    if (status === 'started') {
        document.getElementById('searchStatus').textContent = 'Ride in progress';
        document.getElementById('cancelBookingBtn').classList.add('hidden');
    }
    
    if (status === 'completed') {
        document.getElementById('searchStatus').textContent = 'Ride completed!';
        document.getElementById('cancelBookingBtn').classList.add('hidden');
        document.getElementById('newBookingBtn').classList.remove('hidden');
        
        showToast('Ride completed!', 'success');
        loadDashboard();
        
        // Show rating modal
        setTimeout(() => showRatingModal(state.currentBooking._id), 1000);
    }
    
    if (status === 'cancelled') {
        document.getElementById('searchStatus').textContent = 'Booking cancelled';
        document.querySelector('.driver-search-status .loader').style.display = 'none';
        document.getElementById('cancelBookingBtn').classList.add('hidden');
        document.getElementById('newBookingBtn').classList.remove('hidden');
    }
}

// Cancel booking
async function cancelBooking() {
    if (!state.currentBooking) return;
    
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        const data = await apiRequest(`/user/bookings/${state.currentBooking._id}/cancel`, 'PUT', {
            reason: 'Cancelled by user'
        });
        
        if (data.success) {
            updateBookingStatus('cancelled');
            showToast('Booking cancelled', 'success');
        } else {
            showToast(data.message || 'Cannot cancel booking', 'error');
        }
    } catch (error) {
        console.error('Cancel error:', error);
        showToast('Error cancelling booking', 'error');
    }
}

// Reset booking form
function resetBookingForm() {
    state.currentBooking = null;
    state.selectedVehicle = null;
    state.selectedDriver = null;
    state.availableDrivers = [];
    state.bookingData = {};
    
    document.getElementById('bookPickup').value = '';
    document.getElementById('bookDropoff').value = '';
    document.getElementById('vehiclesList').innerHTML = '';
    document.getElementById('driversList').innerHTML = '';
    document.getElementById('driversSection').classList.add('hidden');
    document.getElementById('confirmVehicleBtn').disabled = true;
    
    document.getElementById('driverDetails').classList.add('hidden');
    document.getElementById('otpSection').classList.add('hidden');
    document.getElementById('cancelBookingBtn').classList.remove('hidden');
    document.getElementById('newBookingBtn').classList.add('hidden');
    document.getElementById('onlinePaymentNotice')?.classList.add('hidden');
    
    // Reset payment selection to cash
    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.payment-option')?.classList.add('selected');
    document.querySelector('input[name="payment"][value="cash"]').checked = true;
    
    document.querySelector('.driver-search-status .loader').style.display = 'block';
    document.getElementById('searchStatus').textContent = 'Searching for nearby drivers...';
    
    document.querySelectorAll('.timeline-item').forEach((item, i) => {
        item.classList.toggle('active', i === 0);
    });
}

// Show rating modal
function showRatingModal(bookingId) {
    const modal = document.getElementById('ratingModal');
    modal.classList.remove('hidden');
    modal.dataset.bookingId = bookingId;
    
    // Star rating
    const stars = modal.querySelectorAll('.rating-stars i');
    let selectedRating = 0;
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
            });
        });
        
        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.dataset.rating);
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < rating);
            });
        });
    });
    
    modal.querySelector('.rating-stars').addEventListener('mouseleave', () => {
        stars.forEach((s, i) => {
            s.classList.toggle('active', i < selectedRating);
        });
    });
    
    document.getElementById('submitRatingBtn').onclick = async () => {
        if (selectedRating === 0) {
            showToast('Please select a rating', 'error');
            return;
        }
        
        try {
            const review = document.getElementById('ratingReview').value;
            const data = await apiRequest(`/user/bookings/${bookingId}/rate`, 'POST', {
                score: selectedRating,
                review
            });
            
            if (data.success) {
                showToast('Thank you for your rating!', 'success');
                modal.classList.add('hidden');
            }
        } catch (error) {
            showToast('Error submitting rating', 'error');
        }
    };
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
        const result = await apiRequest('/user/profile', 'PUT', data);
        
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
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str, length) {
    return str.length > length ? str.slice(0, length) + '...' : str;
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
