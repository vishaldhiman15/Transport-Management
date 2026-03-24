// Admin Dashboard JavaScript
const API_URL = '/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || '{}');
let socket = null;

// Check authentication
if (!token || user.role !== 'admin') {
    window.location.href = '/';
}

// Initialize Socket.IO
function initSocket() {
    socket = io({
        auth: { token }
    });

    socket.on('connect', () => {
        console.log('Connected to socket server');
    });

    socket.on('bookingCreated', (booking) => {
        showToast('New booking created!', 'info');
        loadDashboardStats();
        loadRecentBookings();
    });

    socket.on('bookingStatusChanged', (data) => {
        loadDashboardStats();
        loadRecentBookings();
    });

    socket.on('newDriverRegistration', (driver) => {
        showToast('New driver registration pending approval!', 'warning');
        loadPendingDrivers();
        updatePendingCount();
    });
}

// API Request Helper
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Request failed');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Format Currency
function formatCurrency(amount) {
    return '₹' + (amount || 0).toLocaleString('en-IN');
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(section + 'Section').classList.add('active');
        
        loadSectionData(section);
    });
});

// Link actions
document.querySelectorAll('[data-action]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const action = link.dataset.action;
        const navItem = document.querySelector(`.nav-item[data-section="${action}"]`);
        if (navItem) navItem.click();
    });
});

// Load section data
function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            loadDashboardStats();
            loadRecentBookings();
            loadRecentUsers();
            loadPendingDrivers();
            break;
        case 'users':
            loadUsers();
            break;
        case 'drivers':
            loadDrivers();
            break;
        case 'bookings':
            loadBookings();
            break;
        case 'vehicles':
            loadVehicleTypes();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        const stats = await apiRequest('/admin/stats');
        
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalDrivers').textContent = stats.totalDrivers || 0;
        document.getElementById('activeDrivers').textContent = stats.activeDrivers || 0;
        document.getElementById('pendingApprovals').textContent = stats.pendingDrivers || 0;
        document.getElementById('totalBookings').textContent = stats.totalBookings || 0;
        document.getElementById('completedBookings').textContent = stats.completedBookings || 0;
        document.getElementById('cancelledBookings').textContent = stats.cancelledBookings || 0;
        document.getElementById('totalRevenue').textContent = formatCurrency(stats.totalRevenue);
        
        document.getElementById('todayBookings').textContent = stats.todayBookings || 0;
        document.getElementById('todayRevenue').textContent = formatCurrency(stats.todayRevenue);
        document.getElementById('pendingBookings').textContent = stats.pendingBookings || 0;
        
        updatePendingCount(stats.pendingDrivers);
    } catch (error) {
        showToast('Failed to load stats', 'error');
    }
}

// Update pending count badge
function updatePendingCount(count) {
    const badge = document.getElementById('pendingCount');
    if (count !== undefined) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

// Load Recent Bookings
async function loadRecentBookings() {
    try {
        const bookings = await apiRequest('/admin/bookings?limit=5');
        const list = document.getElementById('recentBookingsList');
        
        if (bookings.length === 0) {
            list.innerHTML = '<li class="empty-state">No recent bookings</li>';
            return;
        }
        
        list.innerHTML = bookings.map(booking => `
            <li>
                <div class="user-item">
                    <img src="${booking.user?.avatar || '/images/default-avatar.png'}" alt="">
                    <div>
                        <strong>${booking.user?.name || 'User'}</strong>
                        <small style="display: block; color: var(--gray);">
                            ${booking.pickup?.address?.substring(0, 30) || 'N/A'}...
                        </small>
                    </div>
                </div>
                <span class="badge badge-${getStatusBadge(booking.status)}">${booking.status}</span>
            </li>
        `).join('');
    } catch (error) {
        console.error('Failed to load recent bookings:', error);
    }
}

// Load Recent Users
async function loadRecentUsers() {
    try {
        const users = await apiRequest('/admin/users?limit=5');
        const list = document.getElementById('recentUsersList');
        
        if (users.length === 0) {
            list.innerHTML = '<li class="empty-state">No recent users</li>';
            return;
        }
        
        list.innerHTML = users.map(user => `
            <li>
                <div class="user-item">
                    <img src="${user.avatar || '/images/default-avatar.png'}" alt="">
                    <div>
                        <strong>${user.name}</strong>
                        <small style="display: block; color: var(--gray);">${user.email}</small>
                    </div>
                </div>
                <small>${formatDate(user.createdAt)}</small>
            </li>
        `).join('');
    } catch (error) {
        console.error('Failed to load recent users:', error);
    }
}

// Load Pending Drivers
async function loadPendingDrivers() {
    try {
        const drivers = await apiRequest('/admin/drivers?status=pending&limit=5');
        const list = document.getElementById('pendingDriversList');
        const section = document.getElementById('pendingApprovalsSection');
        
        if (drivers.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        list.innerHTML = drivers.map(driver => `
            <div class="pending-item">
                <img src="${driver.user?.avatar || '/images/default-avatar.png'}" alt="">
                <div class="info">
                    <strong>${driver.user?.name || 'Driver'}</strong>
                    <div>
                        <span class="vehicle-badge">
                            <i class="fas fa-car"></i> ${driver.vehicleType}
                        </span>
                        <span style="color: var(--gray); margin-left: 10px;">
                            ${driver.vehicleNumber}
                        </span>
                    </div>
                </div>
                <div class="actions">
                    <button class="btn btn-success btn-sm" onclick="approveDriver('${driver._id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="rejectDriver('${driver._id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load pending drivers:', error);
    }
}

// Approve Driver
async function approveDriver(driverId) {
    try {
        await apiRequest(`/admin/drivers/${driverId}/approve`, 'PUT');
        showToast('Driver approved successfully!', 'success');
        loadDashboardStats();
        loadPendingDrivers();
        loadDrivers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Reject Driver
async function rejectDriver(driverId) {
    if (!confirm('Are you sure you want to reject this driver?')) return;
    
    try {
        await apiRequest(`/admin/drivers/${driverId}/reject`, 'PUT');
        showToast('Driver rejected', 'success');
        loadDashboardStats();
        loadPendingDrivers();
        loadDrivers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Load Users
async function loadUsers(search = '') {
    try {
        let url = '/admin/users';
        if (search) url += `?search=${encodeURIComponent(search)}`;
        
        const users = await apiRequest(url);
        const tbody = document.getElementById('usersTableBody');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="user-item">
                        <img src="${user.avatar || '/images/default-avatar.png'}" alt="">
                        <span>${user.name}</span>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    <span class="badge badge-${user.isActive ? 'success' : 'danger'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-outline btn-sm" onclick="viewUser('${user._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-${user.isActive ? 'danger' : 'success'} btn-sm" 
                                onclick="toggleUserStatus('${user._id}', ${!user.isActive})">
                            <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Failed to load users', 'error');
    }
}

// Search Users
function searchUsers() {
    const search = document.getElementById('userSearch').value;
    loadUsers(search);
}

// Toggle User Status
async function toggleUserStatus(userId, activate) {
    try {
        await apiRequest(`/admin/users/${userId}/status`, 'PUT', { isActive: activate });
        showToast(`User ${activate ? 'activated' : 'deactivated'}`, 'success');
        loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Load Drivers
let currentDriverFilter = 'all';

async function loadDrivers(search = '') {
    try {
        let url = '/admin/drivers';
        const params = [];
        
        if (currentDriverFilter !== 'all') {
            if (currentDriverFilter === 'online') {
                params.push('online=true');
            } else {
                params.push(`status=${currentDriverFilter}`);
            }
        }
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        
        if (params.length) url += '?' + params.join('&');
        
        const drivers = await apiRequest(url);
        const tbody = document.getElementById('driversTableBody');
        
        if (drivers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No drivers found</td></tr>';
            return;
        }
        
        tbody.innerHTML = drivers.map(driver => `
            <tr>
                <td>
                    <div class="user-item">
                        <img src="${driver.user?.avatar || '/images/default-avatar.png'}" alt="">
                        <div>
                            <strong>${driver.user?.name || 'Driver'}</strong>
                            <small style="display: block; color: var(--gray);">${driver.user?.phone || ''}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="vehicle-badge">
                        <i class="fas fa-${getVehicleIcon(driver.vehicleType)}"></i>
                        ${driver.vehicleType}
                    </span>
                    <small style="display: block;">${driver.vehicleNumber}</small>
                </td>
                <td>
                    <span style="color: var(--warning);">
                        <i class="fas fa-star"></i> ${driver.rating?.toFixed(1) || '0.0'}
                    </span>
                </td>
                <td>${driver.totalRides || 0}</td>
                <td>
                    <span class="badge badge-${getDriverStatusBadge(driver)}">
                        ${getDriverStatusText(driver)}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-outline btn-sm" onclick="viewDriver('${driver._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${!driver.isApproved ? `
                            <button class="btn btn-success btn-sm" onclick="approveDriver('${driver._id}')">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Failed to load drivers', 'error');
    }
}

// Driver filter tabs
document.querySelectorAll('#driversSection .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#driversSection .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentDriverFilter = tab.dataset.filter;
        loadDrivers();
    });
});

// Search Drivers
function searchDrivers() {
    const search = document.getElementById('driverSearch').value;
    loadDrivers(search);
}

// Get vehicle icon
function getVehicleIcon(type) {
    const icons = {
        'bike': 'motorcycle',
        'auto': 'taxi',
        'sedan': 'car',
        'suv': 'car-side',
        'premium': 'car-alt'
    };
    return icons[type?.toLowerCase()] || 'car';
}

// Get driver status badge
function getDriverStatusBadge(driver) {
    if (!driver.isApproved) return 'warning';
    if (driver.isOnline) return 'success';
    return 'primary';
}

// Get driver status text
function getDriverStatusText(driver) {
    if (!driver.isApproved) return 'Pending';
    if (driver.isOnline) return 'Online';
    return 'Offline';
}

// Load Bookings
let currentBookingStatus = '';

async function loadBookings() {
    try {
        let url = '/admin/bookings';
        if (currentBookingStatus) url += `?status=${currentBookingStatus}`;
        
        const bookings = await apiRequest(url);
        const tbody = document.getElementById('bookingsTableBody');
        
        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No bookings found</td></tr>';
            return;
        }
        
        tbody.innerHTML = bookings.map(booking => `
            <tr>
                <td><code>${booking._id.substring(0, 8)}...</code></td>
                <td>${booking.user?.name || 'N/A'}</td>
                <td>${booking.driver?.user?.name || 'Not assigned'}</td>
                <td>
                    <small>
                        ${booking.pickup?.address?.substring(0, 20) || 'N/A'}... →
                        ${booking.dropoff?.address?.substring(0, 20) || 'N/A'}...
                    </small>
                </td>
                <td>${formatCurrency(booking.fare?.total)}</td>
                <td>
                    <span class="badge badge-${getStatusBadge(booking.status)}">
                        ${booking.status}
                    </span>
                </td>
                <td>${formatDate(booking.createdAt)}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="viewBooking('${booking._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Failed to load bookings', 'error');
    }
}

// Booking filter tabs
document.querySelectorAll('#bookingsSection .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#bookingsSection .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentBookingStatus = tab.dataset.status;
        loadBookings();
    });
});

// Get status badge class
function getStatusBadge(status) {
    const badges = {
        'pending': 'warning',
        'accepted': 'primary',
        'arrived': 'info',
        'started': 'primary',
        'completed': 'success',
        'cancelled': 'danger'
    };
    return badges[status] || 'primary';
}

// Load Vehicle Types
async function loadVehicleTypes() {
    try {
        const vehicles = await apiRequest('/booking/vehicle-types');
        const tbody = document.getElementById('vehiclesTableBody');
        
        if (vehicles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No vehicle types found</td></tr>';
            return;
        }
        
        tbody.innerHTML = vehicles.map(v => `
            <tr>
                <td>
                    <div class="user-item">
                        <i class="fas fa-${getVehicleIcon(v.name)}" style="font-size: 24px; color: var(--primary);"></i>
                        <strong>${v.name}</strong>
                    </div>
                </td>
                <td>${formatCurrency(v.baseFare)}</td>
                <td>${formatCurrency(v.perKm)}/km</td>
                <td>${formatCurrency(v.perMin)}/min</td>
                <td>${formatCurrency(v.minFare)}</td>
                <td>${v.maxPassengers}</td>
                <td>
                    <span class="badge badge-${v.isActive ? 'success' : 'danger'}">
                        ${v.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-outline btn-sm" onclick="editVehicleType('${v._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-${v.isActive ? 'danger' : 'success'} btn-sm" 
                                onclick="toggleVehicleType('${v._id}', ${!v.isActive})">
                            <i class="fas fa-${v.isActive ? 'ban' : 'check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Failed to load vehicle types', 'error');
    }
}

// Toggle Vehicle Type
async function toggleVehicleType(id, activate) {
    try {
        await apiRequest(`/admin/vehicle-types/${id}`, 'PUT', { isActive: activate });
        showToast(`Vehicle type ${activate ? 'activated' : 'deactivated'}`, 'success');
        loadVehicleTypes();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Load Analytics
async function loadAnalytics() {
    try {
        const analytics = await apiRequest('/admin/analytics');
        
        // Vehicle stats
        const vehicleList = document.getElementById('vehicleStatsList');
        if (analytics.vehicleStats?.length) {
            vehicleList.innerHTML = analytics.vehicleStats.map(v => `
                <li>
                    <span class="vehicle-badge">
                        <i class="fas fa-${getVehicleIcon(v._id)}"></i> ${v._id}
                    </span>
                    <strong>${v.count} rides</strong>
                </li>
            `).join('');
        } else {
            vehicleList.innerHTML = '<li class="empty-state">No data available</li>';
        }
        
        // Top drivers
        const driverList = document.getElementById('topDriversList');
        if (analytics.topDrivers?.length) {
            driverList.innerHTML = analytics.topDrivers.map((d, i) => `
                <li>
                    <div class="user-item">
                        <span style="font-weight: bold; color: var(--primary);">#${i + 1}</span>
                        <div>
                            <strong>${d.name}</strong>
                            <small style="display: block; color: var(--gray);">${d.totalRides} rides</small>
                        </div>
                    </div>
                    <span style="color: var(--warning);">
                        <i class="fas fa-star"></i> ${d.rating?.toFixed(1) || '0.0'}
                    </span>
                </li>
            `).join('');
        } else {
            driverList.innerHTML = '<li class="empty-state">No data available</li>';
        }
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

// View functions (placeholder - can expand to modals)
function viewUser(userId) {
    showToast('User details modal coming soon', 'info');
}

function viewDriver(driverId) {
    showToast('Driver details modal coming soon', 'info');
}

function viewBooking(bookingId) {
    showToast('Booking details modal coming soon', 'info');
}

function editVehicleType(id) {
    showToast('Edit vehicle type modal coming soon', 'info');
}

function showAddVehicleModal() {
    showToast('Add vehicle type modal coming soon', 'info');
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
});

// Mobile menu toggle
document.querySelector('.menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('show');
});

// Initialize user info
function initUserInfo() {
    document.getElementById('userName').textContent = user.name || 'Admin';
    if (user.avatar) {
        document.getElementById('userAvatar').src = user.avatar;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initUserInfo();
    initSocket();
    loadSectionData('dashboard');
});
