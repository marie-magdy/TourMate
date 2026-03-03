# TourMate Backend API

A Node.js/Express backend for the TourMate travel companion application with PostgreSQL database and JWT authentication.

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- PostgreSQL (v12+)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Edit `.env` and update:
```env
PORT=3000
JWT_SECRET=your_secure_jwt_secret_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/tourmate
```

### 3. Create PostgreSQL Database
```bash
createdb tourmate
```

### 4. Initialize Database Tables
```bash
npm run init-db
```

This will create the `users` table with the following schema:
- `id` - Primary key (SERIAL)
- `email` - Unique email address
- `password` - Bcrypt hashed password
- `created_at` - Timestamp
- `updated_at` - Timestamp

### 5. Start the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
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
