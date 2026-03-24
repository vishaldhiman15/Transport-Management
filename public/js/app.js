// Global state
const state = {
    user: null,
    token: null,
    location: null,
    locationPermissionAsked: false
};

// API Base URL
const API_URL = '/api';

// DOM Elements
const locationModal = document.getElementById('locationModal');
const app = document.getElementById('app');
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const toast = document.getElementById('toast');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    checkLocationPermission();
});

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        state.token = token;
        state.user = JSON.parse(user);
        redirectToDashboard();
    }
}

// Redirect to appropriate dashboard
function redirectToDashboard() {
    if (!state.user) return;
    
    switch (state.user.role) {
        case 'user':
            window.location.href = '/user/dashboard.html';
            break;
        case 'driver':
            window.location.href = '/driver/dashboard.html';
            break;
        case 'admin':
            window.location.href = '/admin/dashboard.html';
            break;
    }
}

// Check location permission
function checkLocationPermission() {
    const locationAsked = localStorage.getItem('locationAsked');
    const savedLocation = localStorage.getItem('userLocation');
    
    if (savedLocation) {
        state.location = JSON.parse(savedLocation);
        showApp();
        return;
    }
    
    if (locationAsked) {
        showApp();
        return;
    }
    
    // Show location modal
    locationModal.classList.remove('hidden');
}

// Setup event listeners
function setupEventListeners() {
    // Location permission buttons
    document.getElementById('allowLocationBtn').addEventListener('click', requestLocation);
    document.getElementById('skipLocationBtn').addEventListener('click', skipLocation);
    
    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    document.getElementById('signupBtn').addEventListener('click', showSignupModal);
    document.getElementById('footerLogin').addEventListener('click', (e) => { e.preventDefault(); showLoginModal(); });
    document.getElementById('footerSignup').addEventListener('click', (e) => { e.preventDefault(); showSignupModal(); });
    document.getElementById('registerDriverBtn').addEventListener('click', () => {
        showSignupModal();
        // Auto-select driver role
        selectRole('driver');
    });
    
    // Role selection cards
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            const role = card.dataset.role;
            selectRole(role);
        });
    });
    
    // Back to role selection
    document.getElementById('backToRoleBtn').addEventListener('click', () => {
        document.getElementById('signupFormStep').classList.remove('active');
        document.getElementById('roleSelectionStep').classList.add('active');
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Switch between login/signup
    document.getElementById('switchToSignup').addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.add('hidden');
        signupModal.classList.remove('hidden');
        // Reset to role selection
        document.getElementById('signupFormStep').classList.remove('active');
        document.getElementById('roleSelectionStep').classList.add('active');
    });
    
    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        signupModal.classList.add('hidden');
        loginModal.classList.remove('hidden');
    });
    
    // Signup tabs (hidden but kept for compatibility)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.signup-form').forEach(form => form.classList.remove('active'));
            document.getElementById(`${btn.dataset.tab}SignupForm`).classList.add('active');
        });
    });
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // User signup form
    document.getElementById('userSignupForm').addEventListener('submit', handleUserSignup);
    
    // Driver signup form
    document.getElementById('driverSignupForm').addEventListener('submit', handleDriverSignup);
    
    // Search ride button
    document.getElementById('searchRideBtn').addEventListener('click', () => {
        if (!state.user) {
            showLoginModal();
            showToast('Please login to book a ride', 'error');
        } else {
            redirectToDashboard();
        }
    });
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') && e.target !== locationModal) {
            closeAllModals();
        }
    });
}

// Select role and show appropriate form
function selectRole(role) {
    // Update role card selection
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.role-card[data-role="${role}"]`)?.classList.add('selected');
    
    // Update form title
    const title = role === 'driver' ? 'Register as Driver' : 'Create Passenger Account';
    document.getElementById('signupFormTitle').textContent = title;
    
    // Show appropriate form
    document.querySelectorAll('.signup-form').forEach(form => form.classList.remove('active'));
    document.getElementById(`${role}SignupForm`).classList.add('active');
    
    // Update tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${role}"]`)?.classList.add('active');
    
    // Show form step
    document.getElementById('roleSelectionStep').classList.remove('active');
    document.getElementById('signupFormStep').classList.add('active');
}

// Request location permission
function requestLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                localStorage.setItem('userLocation', JSON.stringify(state.location));
                localStorage.setItem('locationAsked', 'true');
                showApp();
                showToast('Location enabled!', 'success');
                
                // Update pickup input with approximate location
                reverseGeocode(state.location.latitude, state.location.longitude);
            },
            (error) => {
                console.error('Location error:', error);
                localStorage.setItem('locationAsked', 'true');
                showApp();
                showToast('Location access denied. You can enter location manually.', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    } else {
        localStorage.setItem('locationAsked', 'true');
        showApp();
        showToast('Geolocation not supported by your browser', 'error');
    }
}

// Skip location permission
function skipLocation() {
    localStorage.setItem('locationAsked', 'true');
    showApp();
}

// Show main app
function showApp() {
    locationModal.classList.add('hidden');
    app.classList.remove('hidden');
}

// Reverse geocode
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`${API_URL}/location/reverse-geocode?latitude=${lat}&longitude=${lng}`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('pickupInput').value = data.address.formatted;
        }
    } catch (error) {
        console.error('Reverse geocode error:', error);
    }
}

// Show login modal
function showLoginModal() {
    closeAllModals();
    loginModal.classList.remove('hidden');
}

// Show signup modal
function showSignupModal() {
    closeAllModals();
    signupModal.classList.remove('hidden');
}

// Close all modals
function closeAllModals() {
    loginModal.classList.add('hidden');
    signupModal.classList.add('hidden');
    
    // Reset signup modal to role selection
    document.getElementById('signupFormStep').classList.remove('active');
    document.getElementById('roleSelectionStep').classList.add('active');
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Check if role matches
            const expectedRole = formData.get('role');
            if (result.user.role !== expectedRole) {
                showToast(`Please select "${result.user.role}" as login type`, 'error');
                return;
            }
            
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            if (result.driver) {
                localStorage.setItem('driver', JSON.stringify(result.driver));
            }
            
            state.token = result.token;
            state.user = result.user;
            
            showToast('Login successful!', 'success');
            closeAllModals();
            
            setTimeout(() => {
                redirectToDashboard();
            }, 500);
        } else {
            showToast(result.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
}

// Handle user signup
async function handleUserSignup(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: formData.get('password'),
        role: 'user'
    };
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            state.token = result.token;
            state.user = result.user;
            
            showToast('Registration successful!', 'success');
            closeAllModals();
            
            setTimeout(() => {
                redirectToDashboard();
            }, 500);
        } else {
            showToast(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast('Registration failed. Please try again.', 'error');
    }
}

// Handle driver signup
async function handleDriverSignup(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: formData.get('password'),
        vehicleType: formData.get('vehicleType'),
        vehicleNumber: formData.get('vehicleNumber'),
        vehicleModel: formData.get('vehicleModel'),
        vehicleColor: formData.get('vehicleColor'),
        licenseNumber: formData.get('licenseNumber'),
        licenseExpiry: formData.get('licenseExpiry')
    };
    
    try {
        const response = await fetch(`${API_URL}/auth/register-driver`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            if (result.driver) {
                localStorage.setItem('driver', JSON.stringify(result.driver));
            }
            
            state.token = result.token;
            state.user = result.user;
            
            showToast('Registration successful! Pending approval.', 'success');
            closeAllModals();
            
            setTimeout(() => {
                redirectToDashboard();
            }, 500);
        } else {
            showToast(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Driver signup error:', error);
        showToast('Registration failed. Please try again.', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// API helper function
async function apiRequest(endpoint, method = 'GET', data = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const options = {
        method,
        headers
    };
    
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    return response.json();
}
