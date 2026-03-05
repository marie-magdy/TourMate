# TourMate Backend - Architecture Overview

## Project Structure

```
backend/
├── config/                 # Configuration files
│   └── database.js        # Sequelize database setup
├── controllers/           # Route handlers
│   └── authController.js  # Authentication endpoints
├── middleware/            # Express middleware
│   └── auth.js           # JWT verification middleware
├── models/               # Database models & ORM
│   └── User.js           # User model with sequential ID generation
├── services/             # Business logic layer
│   └── authService.js    # Authentication service
├── utils/                # Utility functions
│   └── geolocation.js    # City detection by coordinates
├── src/
│   ├── db.js            # PostgreSQL connection pool
│   ├── index.js         # Express app setup
│   ├── init.js          # Database initialization with seed data
│   └── routes/
│       └── auth.js      # Authentication routes
├── package.json         # Dependencies
└── README.md
```

## Architecture Pattern

This project follows the **MVC (Model-View-Controller)** pattern with additional layers:

- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and database operations
- **Models**: Define data structure and validation
- **Middleware**: Cross-cutting concerns (JWT auth, validation)
- **Utils**: Shared utility functions (geolocation)

## Key Features

### 1. Sequential User IDs
- Format: `USR001`, `USR002`, `USR003`, etc.
- Automatically generated based on the highest existing user_id
- Uses PostgreSQL substring/cast functions for efficient queries

### 2. Geolocation-Based City Assignment
- Users can provide `latitude` and `longitude` during registration/location update
- Automatically assigns the nearest Egyptian city using Haversine distance formula
- Default city: Cairo (coordinates: 30.0444, 31.2357)
- Supports 13 major Egyptian cities

### 3. Clean Architecture
- Separation of concerns between controllers, services, and models
- Easy to test and maintain
- Clear data flow: Routes → Controllers → Services → Database

## API Endpoints

### Authentication Routes (`/api/auth`)

#### 1. Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "latitude": 30.0444,      # Optional - for geolocation-based city
  "longitude": 31.2357      # Optional
}

Response (201):
{
  "message": "User registered successfully",
  "user": {
    "user_id": "USR001",
    "name": "John Doe",
    "email": "john@example.com",
    "current_city": "Cairo"
  }
}
```

#### 2. Login User
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response (200):
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "USR001",
    "name": "John Doe",
    "email": "john@example.com",
    "current_city": "Cairo"
  }
}
```

#### 3. Update User Location
```
PUT /api/auth/location
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "latitude": 31.2001,
  "longitude": 29.9187
}

Response (200):
{
  "message": "Location updated successfully",
  "user": {
    "user_id": "USR001",
    "name": "John Doe",
    "email": "john@example.com",
    "current_city": "Alexandria",  # Updated based on coordinates
    "latitude": 31.2001,
    "longitude": 29.9187
  }
}
```

## Supported Egyptian Cities

| City_ID | City Name | Latitude | Longitude |
|---------|-----------|----------|-----------|
| CIT001 | Cairo | 30.0444 | 31.2357 |
| CIT002 | Alexandria | 31.2001 | 29.9187 |
| CIT003 | Giza | 29.9792 | 31.1342 |
| CIT004 | Aswan | 24.0889 | 32.8998 |
| CIT005 | Luxor | 25.6872 | 32.6396 |
| CIT006 | South Sinai | 27.7171 | 34.2922 |
| CIT007 | Red Sea | 27.1317 | 33.6346 |
| CIT008 | Ismailia | 30.5948 | 32.2729 |
| CIT009 | Fayoum | 29.3084 | 30.8425 |
| CIT010 | New Valley | 25.3765 | 30.7565 |
| CIT011 | North Coast | 31.2704 | 30.3572 |
| CIT012 | Matrouh | 31.3423 | 27.2373 |
| CIT013 | Abu Simbel | 22.3474 | 31.6061 |

## Service Functions

### authService.js

- **registerUser(userData)**: Create a new user with sequential ID
- **findUserByEmail(email)**: Query user by email
- **findUserById(user_id)**: Query user by ID
- **comparePasswords(plainPassword, hashedPassword)**: Verify password
- **updateUserLocation(user_id, latitude, longitude)**: Update user city

### geolocation.js

- **getNearestCity(latitude, longitude)**: Return nearest city object
- **isInEgypt(latitude, longitude)**: Validate coordinates are in Egypt
- **calculateDistance(lat1, lon1, lat2, lon2)**: Haversine distance formula

## Setup & Installation

### Prerequisites
- Node.js >= 14
- PostgreSQL >= 12
- npm

### Steps
1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/tourmate
   JWT_SECRET=your_jwt_secret_key
   PORT=3000
   ```

3. Initialize database:
   ```bash
   npm run init-db
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Database Schema

### users table
```sql
CREATE TABLE users (
  user_id VARCHAR(10) PRIMARY KEY,      -- USR001, USR002, etc.
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  language VARCHAR(50) DEFAULT 'English',
  current_city VARCHAR(100) DEFAULT 'Cairo',
  accessibility_needs VARCHAR(255) DEFAULT 'None',
  is_admin BOOLEAN DEFAULT false,
  eco_points INTEGER DEFAULT 0,
  sustainability_level VARCHAR(50) DEFAULT 'Bronze',
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Backward Compatibility

All existing routes and database operations remain unchanged. The refactoring:
- ✅ Keeps all working code intact
- ✅ Only improves code organization and structure
- ✅ Maintains same API contracts
- ✅ Adds new features without breaking changes

## Error Handling

Common HTTP Status Codes:
- `201`: User created successfully
- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (invalid credentials or token)
- `409`: Conflict (email already exists)
- `500`: Server error

## Future Enhancements

- [ ] Add profile picture upload
- [ ] Implement password reset via email
- [ ] Add email verification
- [ ] User profile management endpoints
- [ ] Integration with maps API for accurate location services
