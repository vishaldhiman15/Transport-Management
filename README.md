# TransportPro - Transport Management System

A complete transport/ride-booking management system with real-time tracking, similar to Uber/Ola. Built with Node.js, Express, MongoDB, and Socket.IO.

## Features

- **User Dashboard**: Book rides, track drivers in real-time, view ride history
- **Driver Dashboard**: Accept/reject rides, manage availability, earnings tracking
- **Admin Dashboard**: Manage users, drivers, bookings, vehicle types, and analytics
- **Real-time Tracking**: Live location updates using Socket.IO
- **Location Services**: Automatic location detection with browser Geolocation API
- **Multiple Vehicle Types**: Bike, Auto, Sedan, SUV, Premium
- **Fare Calculation**: Dynamic pricing based on distance and time

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Frontend**: Pure HTML, CSS, JavaScript (no frameworks)
- **Password Hashing**: bcryptjs

## Project Structure

```
Transport management system/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── .env                   # Environment variables
├── seed.js                # Database seeding script
├── models/
│   ├── User.js            # User schema
│   ├── Driver.js          # Driver profile schema
│   ├── Booking.js         # Booking schema
│   └── VehicleType.js     # Vehicle type schema
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── user.js            # User routes
│   ├── driver.js          # Driver routes
│   ├── admin.js           # Admin routes
│   ├── booking.js         # Booking routes
│   └── location.js        # Location routes
├── middleware/
│   └── auth.js            # JWT authentication middleware
└── public/
    ├── index.html         # Landing page
    ├── css/
    │   ├── style.css      # Main styles
    │   └── dashboard.css  # Dashboard styles
    ├── js/
    │   ├── app.js         # Landing page JS
    │   ├── user-dashboard.js
    │   ├── driver-dashboard.js
    │   └── admin-dashboard.js
    ├── user/
    │   └── dashboard.html
    ├── driver/
    │   └── dashboard.html
    ├── admin/
    │   └── dashboard.html
    └── images/
        └── default-avatar.svg
```

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Steps

1. **Navigate to project directory**
   ```bash
   cd "Transport management system"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Edit the `.env` file if needed:
   ```env
   PORT=3000
   MONGODB_URI= Your mongo db url / you want to make db name 
   JWT_SECRET= you can make your own 
   JWT_EXPIRE=your can choose end day to expire jwt
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Seed the database (optional but recommended)**
   ```bash
   node seed.js
   ```
   This creates:
   - Default vehicle types (Bike, Auto, Sedan, SUV, Premium)
   - Admin user
   - Test user
   - Test drivers
   - Sample completed booking

6. **Start the server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

7. **Open in browser**
   ```
   http://localhost:3000
   ```

## Default Login Credentials

After running `node seed.js`:




# Transport-Management
