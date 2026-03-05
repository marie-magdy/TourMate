/**
 * Database Setup Guide
 * 
 * Instructions for setting up the PostgreSQL database for TourMate
 */

## Database Setup Instructions

### Step 1: Create PostgreSQL Database

```bash
# Create database
createdb tourmate

# Or using psql:
psql -U postgres -c "CREATE DATABASE tourmate;"
```

### Step 2: Connect to Database

```bash
# Connect to the tourmate database
psql -U postgres -d tourmate

# Or if using a different user:
psql -U your_username -d tourmate
```

### Step 3: Create Tables Schema

Run the following SQL commands in order:

#### Create Extension for UUID (if needed)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### Create Cities Table
```sql
CREATE TABLE cities (
  city_id VARCHAR(10) PRIMARY KEY,
  city_name VARCHAR(100) NOT NULL UNIQUE,
  country VARCHAR(50) NOT NULL,
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cities_name ON cities(city_name);
```

#### Create Categories Table
```sql
CREATE TABLE categories (
  category_id VARCHAR(10) PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Create Users Table
```sql
CREATE TABLE users (
  user_id VARCHAR(10) PRIMARY KEY,
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_current_city ON users(current_city);
CREATE INDEX idx_users_location ON users(latitude, longitude);
```

#### Create Attractions Table
```sql
CREATE TABLE attractions (
  attraction_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city_id VARCHAR(10) NOT NULL,
  district VARCHAR(100),
  latitude FLOAT,
  longitude FLOAT,
  address VARCHAR(255),
  sub_type VARCHAR(50),
  is_outdoor INTEGER DEFAULT 0,
  avg_visit_hrs FLOAT,
  admission_egp FLOAT,
  avg_rating FLOAT DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  open_hour INTEGER,
  close_hour INTEGER,
  meal_slot VARCHAR(255),
  price_range VARCHAR(100),
  crowd_label VARCHAR(50),
  crowd_pattern VARCHAR(100),
  description TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (city_id) REFERENCES cities(city_id)
);

CREATE INDEX idx_attractions_city ON attractions(city_id);
CREATE INDEX idx_attractions_location ON attractions(latitude, longitude);
CREATE INDEX idx_attractions_name ON attractions(name);
```

#### Create Attraction Categories Junction Table
```sql
CREATE TABLE attraction_categories (
  attraction_id VARCHAR(10) NOT NULL,
  category_id VARCHAR(10) NOT NULL,
  PRIMARY KEY (attraction_id, category_id),
  FOREIGN KEY (attraction_id) REFERENCES attractions(attraction_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);

CREATE INDEX idx_attraction_categories_attraction ON attraction_categories(attraction_id);
CREATE INDEX idx_attraction_categories_category ON attraction_categories(category_id);
```

#### Create User Liked Attractions Table
```sql
CREATE TABLE user_liked_attractions (
  user_id VARCHAR(10) NOT NULL,
  attraction_id VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, attraction_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (attraction_id) REFERENCES attractions(attraction_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_liked_attractions_user ON user_liked_attractions(user_id);
CREATE INDEX idx_user_liked_attractions_attraction ON user_liked_attractions(attraction_id);
```

### Step 4: Seed Initial Data

```bash
# Run the initialization script (from backend directory)
npm run init-db

# This will:
# 1. Insert seed users (USR001 → USR010)
# 2. Insert cities data
# 3. Insert categories
# 4. Insert attractions
# 5. Create relationships
```

### Step 5: Verify Setup

```bash
# Check tables exist
\dt

# Check users table
SELECT COUNT(*) FROM users;

# Check cities table
SELECT COUNT(*) FROM cities;

# Verify user_id format
SELECT user_id, name, email, current_city FROM users LIMIT 5;
```

### Step 6: Environment Configuration

Create `.env` file in backend directory:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/tourmate
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=3000
NODE_ENV=development
```

## Database Diagram (Entity Relationship)

```
┌─────────────────┐
│     USERS       │
├─────────────────┤
│ PK user_id (10) │
│    email        │
│  password       │
│ current_city    │
│  latitude       │
│  longitude      │
└─────────────────┘
        └────┐
             │
             ├─────────────────────────┐
             │                         │
        ┌────▼──────┐        ┌─────────▼────┐
        │ CITIES    │        │ ATTRACTIONS  │
        ├───────────┤        ├──────────────┤
        │ city_id   │◄───────│  city_id(FK) │
        │ city_name │        │ attraction_id│
        │ latitude  │        │ latitude     │
        │ longitude │        │ longitude    │
        └───────────┘        └──────────────┘
                                     │
                                     │
                         ┌───────────┴────────────┐
                         │                        │
                    ┌────▼──────────────┐   ┌────▼──────────┐
                    │ ATTRACTION_       │   │ USER_LIKED_   │
                    │ CATEGORIES        │   │ ATTRACTIONS   │
                    ├───────────────────┤   ├───────────────┤
                    │ attraction_id(FK) │   │ user_id(FK)   │
                    │ category_id(FK)   │   │ attraction_id( │
                    └────────────────────┘   │ FK)           │
                                             └───────────────┘
                         │
                         │
                    ┌────▼──────────┐
                    │ CATEGORIES    │
                    ├───────────────┤
                    │ category_id   │
                    │ category_name │
                    └───────────────┘
```

## Reset Database (if needed)

```bash
# Drop all tables (WARNING: This deletes all data!)
psql -U postgres -d tourmate -c "
  DROP TABLE IF EXISTS user_liked_attractions;
  DROP TABLE IF EXISTS attraction_categories;
  DROP TABLE IF EXISTS attractions;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS cities;
"

# Recreate tables
# Re-run all CREATE TABLE commands from Step 3
```

## Backup Database

```bash
# Backup entire database
pg_dump -U postgres tourmate > tourmate_backup.sql

# Restore from backup
psql -U postgres tourmate < tourmate_backup.sql
```

## Performance Tuning

```sql
-- Analyze query performance
ANALYZE;

-- Check index usage
SELECT * FROM pg_indexes WHERE tablename = 'users';

-- View table statistics
SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables;
```

## Troubleshooting

### Connection Refused
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL service
# macOS (Homebrew): brew services start postgresql
# Linux (systemd): sudo systemctl start postgresql
# Windows: Services > PostgreSQL > Start
```

### Permission Denied
```bash
# Check user privileges
psql -U postgres -d tourmate -c "SELECT current_user;"

# Grant privileges
psql -U postgres -d tourmate -c "GRANT ALL PRIVILEGES ON DATABASE tourmate TO your_user;"
```

### Database Already Exists
```bash
# Drop existing database
psql -U postgres -c "DROP DATABASE IF EXISTS tourmate;"

# Create fresh database
psql -U postgres -c "CREATE DATABASE tourmate;"
```

## Initial Data

The `init.js` script automatically creates:

- **10 Users** (USR001-USR010) with diverse data
- **13 Cities** (Cairo, Alexandria, Giza, Aswan, Luxor, etc.)
- **20 Categories** (historical, ancient, museum, beach, etc.)
- **87 Attractions** across all Egyptian cities
- **20 User-Liked Attractions** relationships
- **Full Attraction-Category mappings**

## Testing the Setup

```bash
# Start the server
npm run dev

# Test health check
curl http://localhost:3000/

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "latitude": 30.0444,
    "longitude": 31.2357
  }'
```

---

**Ready to go!** Your database is now fully set up and ready for TourMate backend.
