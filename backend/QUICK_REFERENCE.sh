#!/bin/bash

# TourMate Backend - Quick Reference for Developers
# This file contains commonly used commands and quick snippets

## ============================================================
## SETUP & INSTALLATION
## ============================================================

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Then edit .env with your database credentials

# Initialize database (creates tables + seed data)
npm run init-db

# Start development server (auto-reload on file changes)
npm run dev


## ============================================================
## QUICK TESTING WITH CURL
## ============================================================

# Health Check
curl http://localhost:3000/

# Register User (with location)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "password": "password123",
    "latitude": 30.0444,
    "longitude": 31.2357
  }'

# Register User (without location - defaults to Cairo)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fatima Nour",
    "email": "fatima@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "password": "password123"
  }'

# Update Location (requires JWT token from login response)
# Replace TOKEN with actual JWT token from login response
curl -X PUT http://localhost:3000/api/auth/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "latitude": 31.2001,
    "longitude": 29.9187
  }'


## ============================================================
## DATABASE COMMANDS
## ============================================================

# Connect to database
psql -U postgres -d tourmate

# Create database
createdb tourmate

# Drop database (WARNING: Deletes all data)
dropdb tourmate

# Backup database
pg_dump -U postgres tourmate > tourmate_backup.sql

# Restore database
psql -U postgres tourmate < tourmate_backup.sql

# Check users table
psql -U postgres -d tourmate -c "SELECT user_id, name, email, current_city FROM users LIMIT 10;"

# Check next user ID
psql -U postgres -d tourmate -c "
  SELECT CONCAT('NEXT: USR', LPAD(CAST(
    CAST(SUBSTRING(MAX(user_id), 4) AS INTEGER) + 1 AS TEXT
  ), 3, '0'))
  FROM users WHERE user_id LIKE 'USR%';
"

# Find users by city
psql -U postgres -d tourmate -c "
  SELECT user_id, name, current_city FROM users WHERE current_city = 'Cairo';
"


## ============================================================
## FILE LOCATIONS
## ============================================================

# Core Application
src/index.js                    # Main app setup
src/db.js                       # Database connection

# Authentication
controllers/authController.js   # Register, login handlers
services/authService.js         # Auth business logic
middleware/auth.js              # JWT verification
routes/auth.js                  # API endpoints

# Data
models/User.js                  # User model + sequential ID
utils/geolocation.js            # City detection

# Configuration
config/database.js              # Sequelize setup
.env                            # Environment variables
.env.example                    # Template


## ============================================================
## IMPORTANT FUNCTIONS
## ============================================================

# Generate next sequential user ID
# Location: models/User.js
// Usage:
import { generateNextUserId } from '../models/User.js';
const nextId = await generateNextUserId();
// Returns: USR001, USR002, etc.

# Find nearest city
# Location: utils/geolocation.js
// Usage:
import { getNearestCity } from '../utils/geolocation.js';
const city = getNearestCity(latitude, longitude);
// Returns: { city_name: 'Cairo', city_id: 'CIT001', distance: 0.5 }

# Register user
# Location: services/authService.js
// Usage:
import { registerUser } from '../services/authService.js';
const user = await registerUser({
  name: 'Ahmed',
  email: 'ahmed@example.com',
  password: 'password123',
  latitude: 30.0444,
  longitude: 31.2357
});

# Verify JWT
# Location: middleware/auth.js
// Used as middleware:
router.put('/location', authenticateToken, updateLocation);


## ============================================================
## COMMON TASKS
## ============================================================

# Add a new route
1. Create handler function in controllers/
2. Create business logic in services/
3. Add route to src/routes/auth.js
4. Example: router.post('/path', handler);

# Test new endpoint
1. Start server: npm run dev
2. Use curl command above OR
3. Use API client (Postman, REST Client, etc.)
4. Check response and logs

# Debug user registration
1. Add console.log in authService.js registerUser()
2. Check: Sequential ID is generated
3. Check: City is detected from coordinates
4. Check: Password is hashed
5. Check: User is saved to database

# Debug JWT authentication
1. Ensure token is in Authorization header
2. Check header format: "Bearer <token>"
3. Verify JWT_SECRET in .env matches
4. Check token hasn't expired (7 days)

# Add new city support
1. Update utils/geolocation.js egyptianCities array
2. Add to API_TESTING.md docs
3. Test with new coordinates
4. Add to ARCHITECTURE.md table


## ============================================================
## ERROR MESSAGES & SOLUTIONS
## ============================================================

# "Email already registered"
Solution: Use different email address

# "Password must be at least 6 characters"
Solution: Use password with 6+ characters

# "Invalid email address"
Solution: Use valid email format: user@domain.com

# "No token provided"
Solution: Add Authorization header: Authorization: Bearer <token>

# "Invalid token" or "Token expired"
Solution: Login again to get new token (7 day expiration)

# "Database connection error"
Solution: 
  1. Check DATABASE_URL in .env
  2. Verify PostgreSQL is running
  3. Verify database exists
  4. Check username/password

# "Cannot find module"
Solution: Run "npm install" to install dependencies

# User gets same ID (not sequential)
Solution:
  1. Check user_id column type (VARCHAR(10))
  2. Verify database has users
  3. Check generateNextUserId() logic
  4. Query DB: SELECT MAX(user_id) FROM users WHERE user_id LIKE 'USR%'


## ============================================================
## PERFORMANCE TIPS
## ============================================================

# Add database indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_current_city ON users(current_city);
CREATE INDEX idx_users_location ON users(latitude, longitude);

# Check slow queries
psql -d tourmate -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;"

# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

# Monitor connections
psql -d tourmate -c "SELECT count(*) FROM pg_stat_activity;"


## ============================================================
## SECURITY REMINDERS
## ============================================================

✓ ALWAYS use JWT_SECRET from .env (never hardcode)
✓ ALWAYS hash passwords with bcrypt (never store plain)
✓ ALWAYS validate input before DB operations
✓ ALWAYS use HTTPS in production
✓ ALWAYS keep dependencies updated: npm update
✓ NEVER commit .env file (use .env.example)
✓ NEVER log sensitive data (passwords, tokens)


## ============================================================
## USEFUL LINKS & REFERENCES
## ============================================================

Documentation Files:
- README.md - Overview and quick start
- ARCHITECTURE.md - System design details
- API_TESTING.md - API testing examples
- MIGRATION.md - Database setup
- DATABASE_SETUP.md - Database configuration
- IMPLEMENTATION_CHECKLIST.md - What was implemented
- IMPLEMENTATION_SUMMARY.md - Summary of changes

External References:
- Express.js: https://expressjs.com
- JWT: https://jwt.io
- Bcrypt: https://www.npmjs.com/package/bcrypt
- PostgreSQL: https://www.postgresql.org
- Sequelize: https://sequelize.org


## ============================================================
## DEPLOYMENT CHECKLIST
## ============================================================

Before going to production:

[ ] All tests passing
[ ] Environment variables configured
[ ] Database migrated
[ ] HTTPS enabled
[ ] JWT_SECRET is strong (32+ characters)
[ ] Database backed up
[ ] Logs configured/monitored
[ ] Error handling in place
[ ] Rate limiting added
[ ] CORS configured correctly
[ ] Dependencies updated
[ ] Code reviewed
[ ] Documentation updated


## ============================================================
## QUICK START TEMPLATE
## ============================================================

# Full setup from scratch (5 minutes)

# 1. Install & Setup
npm install
cp .env.example .env
# Edit .env with database credentials

# 2. Create Database
createdb tourmate

# 3. Initialize
npm run init-db

# 4. Start
npm run dev

# 5. Test (in another terminal)
curl http://localhost:3000/
# Should return: {"message":"TourMate API is running"}

# 6. Register test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "latitude": 30.0444,
    "longitude": 31.2357
  }'
# Should return: user_id: USR001 (sequential!)

# Done! API is ready for use


## ============================================================

# For more detailed information, see:
# - README.md for overview
# - ARCHITECTURE.md for design details
# - API_TESTING.md for comprehensive examples

# Last Updated: March 5, 2026
