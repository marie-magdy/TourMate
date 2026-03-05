# TourMate Backend API

A modern, clean-architecture Node.js/Express backend for the TourMate travel companion application. Features sequential user ID generation, geolocation-based city assignment, and well-organized MVC pattern.

## 🎯 Key Features

✅ **Sequential User IDs** - Format: USR001, USR002, etc.  
✅ **Geolocation-Based City Assignment** - Automatically detects nearest Egyptian city  
✅ **Clean Architecture** - Controllers, Services, Models, Middleware separation  
✅ **JWT Authentication** - Secure token-based authentication  
✅ **PostgreSQL Database** - Reliable relational database  
✅ **Bcrypt Password Hashing** - Industry-standard security  

## 📁 Project Structure

```
backend/
├── config/              # Configuration
│   └── database.js     # Sequelize setup
├── controllers/         # Route handlers
├── middleware/          # Express middleware (JWT auth)
├── models/             # Database models
├── services/           # Business logic
├── utils/              # Utilities (geolocation)
├── src/
│   ├── db.js          # Database connection pool
│   ├── index.js       # Main app
│   ├── init.js        # Database seeding
│   └── routes/        # API routes
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js v14+
- PostgreSQL v12+
- npm

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/tourmate
   JWT_SECRET=your_super_secret_key_here
   PORT=3000
   NODE_ENV=development
   ```

3. **Initialize database:**
   ```bash
   npm run init-db
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

Server runs on `http://localhost:3000`

## 📚 API Documentation

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Ahmed Hassan",
  "email": "ahmed@example.com",
  "password": "password123",
  "latitude": 30.0444,
  "longitude": 31.2357
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "user_id": "USR001",
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "current_city": "Cairo"
  }
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": "USR001",
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "current_city": "Cairo"
  }
}
```

### Update Location
```http
PUT /api/auth/location
Content-Type: application/json
Authorization: Bearer <token>

{
  "latitude": 31.2001,
  "longitude": 29.9187
}
```

**Response (200):**
```json
{
  "message": "Location updated successfully",
  "user": {
    "user_id": "USR001",
    "current_city": "Alexandria",
    "latitude": 31.2001,
    "longitude": 29.9187
  }
}
```

## 🌍 Supported Egyptian Cities

| City | Latitude | Longitude |
|------|----------|-----------|
| Cairo | 30.0444 | 31.2357 |
| Alexandria | 31.2001 | 29.9187 |
| Giza | 29.9792 | 31.1342 |
| Aswan | 24.0889 | 32.8998 |
| Luxor | 25.6872 | 32.6396 |
| South Sinai | 27.7171 | 34.2922 |
| Red Sea | 27.1317 | 33.6346 |
| Ismailia | 30.5948 | 32.2729 |
| Fayoum | 29.3084 | 30.8425 |
| New Valley | 25.3765 | 30.7565 |
| North Coast | 31.2704 | 30.3572 |
| Matrouh | 31.3423 | 27.2373 |
| Abu Simbel | 22.3474 | 31.6061 |

## 📖 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system design
- **[MIGRATION.md](./MIGRATION.md)** - Database migration guide
- **[API_TESTING.md](./API_TESTING.md)** - API testing examples & cURL commands

## 🔐 Authentication

All requests to protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens are valid for **7 days** and include `user_id` and `email` claims.

## 🛠️ Scripts

```bash
npm run dev       # Start development server with auto-reload
npm run init-db   # Initialize database with seed data
```

## 🗄️ Database Schema

### users table
- `user_id` (VARCHAR(10), PK) - Sequential ID: USR001, USR002, etc.
- `name` (VARCHAR(255))
- `email` (VARCHAR(255), UNIQUE)
- `password` (VARCHAR(255)) - Bcrypt hashed
- `current_city` (VARCHAR(100))
- `latitude` (FLOAT)
- `longitude` (FLOAT)
- `language` (VARCHAR(50))
- `accessibility_needs` (VARCHAR(255))
- `is_admin` (BOOLEAN)
- `eco_points` (INTEGER)
- `sustainability_level` (VARCHAR(50))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## 🔍 How It Works

### Sequential User ID Generation
The system queries the database for the highest existing user ID matching the pattern `USR%`, extracts the number, and increments it. For example:
- First user → USR001
- Second user → USR002
- Tenth user → USR010
- Hundredth user → USR100

### Geolocation-Based City Assignment
When a user registers or updates their location with `latitude` and `longitude`:
1. System calculates Haversine distance to all 13 Egyptian cities
2. Finds the nearest city
3. Automatically updates `current_city` field

Example: User at (31.2001, 29.9187) → Nearest city is Alexandria

## ⚡ Performance Optimizations

- Indexes on `user_id`, `email`, `current_city` for fast queries
- Connection pooling via PostgreSQL pool
- JWT parsing with signature validation

## 🐛 Error Handling

| Status | Description | Example |
|--------|-------------|---------|
| 201 | Resource created | User registered successfully |
| 200 | Success | Login/Location update successful |
| 400 | Bad request | Missing required fields |
| 401 | Unauthorized | Invalid credentials or token |
| 409 | Conflict | Email already registered |
| 500 | Server error | Database connection failed |

## 🔄 Backward Compatibility

✅ All existing code and routes remain unchanged  
✅ Clean refactoring preserves all functionality  
✅ Same API contracts  
✅ No breaking changes  

## 🚧 Future Enhancements

- [ ] Email verification
- [ ] Password reset via email
- [ ] User profile endpoints
- [ ] Profile picture upload
- [ ] Maps API integration for precise locations
- [ ] Rate limiting
- [ ] API versioning

## 📝 License

ISC

## 👤 Contributors

Team TourMate
npm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication

#### Register
- **POST** `/auth/register`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "id": 1,
    "email": "user@example.com"
  }
  ```

#### Login
- **POST** `/auth/login`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com"
    }
  }
  ```

## File Structure
```
backend/
├── src/
│   ├── index.js           # Main server entry point
│   ├── db.js              # Database connection pool
│   ├── initDb.js          # Database initialization script
│   └── routes/
│       └── auth.js        # Authentication routes
├── .env                   # Environment variables
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Notes
- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens expire after 7 days
- CORS is enabled for all origins (update in production)
- Error handling includes validation and database error management
