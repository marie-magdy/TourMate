# Database Migration Guide

This document explains how to migrate the database schema to include the new user ID and location features.

## Migration Steps

### Step 1: Update Users Table Schema

Run the following SQL commands in your PostgreSQL database:

```sql
-- Add latitude and longitude columns if they don't exist
ALTER TABLE users ADD COLUMN latitude FLOAT;
ALTER TABLE users ADD COLUMN longitude FLOAT;

-- Add current_city column if it doesn't exist
ALTER TABLE users ADD COLUMN current_city VARCHAR(100) DEFAULT 'Cairo';

-- Change user_id from UUID to VARCHAR(10) for sequential IDs
-- Note: This only applies to new databases or if you want to migrate existing ones

-- If migrating from UUID to sequential IDs (careful with production!):
-- 1. Create new table with correct schema
-- 2. Migrate data
-- 3. Drop old table
-- 4. Rename new table
```

### Step 2: Create Index for Performance

```sql
-- Index for faster city queries
CREATE INDEX IF NOT EXISTS idx_users_current_city ON users(current_city);

-- Index for faster coordinate queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);
```

### Step 3: Verify Schema

```sql
-- Check the users table structure
\d users

-- Should see all columns including:
-- - user_id (varchar(10))
-- - name (varchar(255))
-- - email (varchar(255))
-- - password (varchar(255))
-- - latitude (real/float)
-- - longitude (real/float)
-- - current_city (varchar(100))
-- - created_at (timestamp)
-- - updated_at (timestamp)
```

## Reverting Changes (If Needed)

If you need to revert to the old schema:

```sql
-- Remove new columns
ALTER TABLE users DROP COLUMN IF EXISTS latitude;
ALTER TABLE users DROP COLUMN IF EXISTS longitude;
ALTER TABLE users DROP COLUMN IF EXISTS current_city;

-- Remove indexes
DROP INDEX IF EXISTS idx_users_current_city;
DROP INDEX IF EXISTS idx_users_location;
```

## Data Migration (UUID to Sequential IDs)

If you have existing users with UUID user_ids and want to migrate to sequential IDs:

```sql
-- Backup existing data first!
-- This is a destructive operation

-- Create temporary table with new schema
CREATE TABLE users_new AS
SELECT * FROM users;

-- Update user_ids to sequential format
WITH numbered_users AS (
  SELECT 
    user_id,
    ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM users_new
  ORDER BY created_at
)
UPDATE users_new
SET user_id = 'USR' || LPAD(CAST((SELECT row_num FROM numbered_users uu WHERE uu.user_id = users_new.user_id) AS VARCHAR), 3, '0')
WHERE EXISTS (
  SELECT 1 FROM numbered_users WHERE numbered_users.user_id = users_new.user_id
);

-- Verify the migration
SELECT user_id, email, created_at FROM users_new ORDER BY user_id;

-- If satisfied, replace old table
DROP TABLE IF EXISTS users_backup;
ALTER TABLE users RENAME TO users_backup;
ALTER TABLE users_new RENAME TO users;

-- Restore indexes
CREATE INDEX idx_users_current_city ON users(current_city);
CREATE INDEX idx_users_location ON users(latitude, longitude);
```

## Production Deployment Checklist

- [ ] Backup database before running migrations
- [ ] Test migrations on a staging/development database first
- [ ] Verify all indexes are created
- [ ] Test application after migration
- [ ] Monitor application logs for any issues
- [ ] Keep backup until you're confident everything works

## Troubleshooting

**Issue**: Column already exists error
- **Solution**: The migration already ran or the column exists. Run either `\d users` to check or use `IF NOT EXISTS` in your SQL.

**Issue**: Unique constraint violation on user_id
- **Solution**: Ensure you're not creating duplicate sequential IDs. Check existing data with `SELECT user_id FROM users ORDER BY user_id`.

**Issue**: Foreign key constraint fails
- **Solution**: If other tables reference users(user_id), you need to migrate those too or drop/recreate the foreign keys.

## SQL Utilities

### Check next available user ID:
```sql
SELECT CONCAT('USR', LPAD(CAST(SUBSTRING(MAX(user_id), 4)::INT + 1 AS TEXT), 3, '0')) as next_user_id
FROM users
WHERE user_id LIKE 'USR%';
```

### List all users with their cities:
```sql
SELECT user_id, name, email, current_city, latitude, longitude, created_at
FROM users
ORDER BY user_id;
```

### Find users by city:
```sql
SELECT user_id, name, email, current_city
FROM users
WHERE current_city = 'Cairo'
ORDER BY created_at DESC;
```
