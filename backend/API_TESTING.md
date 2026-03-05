# TourMate API Testing Guide

This guide provides example requests and responses for testing the TourMate backend API.

## Setup

### Start the Server
```bash
npm install
npm run dev
```

The server will run on `http://localhost:3000`

### Using Postman, cURL, or REST Client

All examples below are formatted for easy copying into your API testing tool.

---

## User Registration

### Request: Register New User (Cairo)

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

**Expected Response** (201 Created):
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

---

### Request: Register User (Alexandria)

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Fatima Nour",
  "email": "fatima@example.com",
  "password": "securepass456",
  "latitude": 31.2001,
  "longitude": 29.9187
}
```

**Expected Response** (201 Created):
```json
{
  "message": "User registered successfully",
  "user": {
    "user_id": "USR002",
    "name": "Fatima Nour",
    "email": "fatima@example.com",
    "current_city": "Alexandria"
  }
}
```

---

### Request: Register User (No Location - Default to Cairo)

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Omar Khalil",
  "email": "omar@example.com",
  "password": "mypassword789"
}
```

**Expected Response** (201 Created):
```json
{
  "message": "User registered successfully",
  "user": {
    "user_id": "USR003",
    "name": "Omar Khalil",
    "email": "omar@example.com",
    "current_city": "Cairo"
  }
}
```

---

## Error Cases

### Request: Missing Required Field

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Name, email, and password are required"
}
```

---

### Request: Invalid Email Format

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "invalid-email",
  "password": "password123"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Please enter a valid email address"
}
```

---

### Request: Password Too Short

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "123"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Password must be at least 6 characters"
}
```

---

### Request: Email Already Registered

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Another User",
  "email": "ahmed@example.com",
  "password": "password123"
}
```

**Expected Response** (409 Conflict):
```json
{
  "error": "Email already registered. Please use a different email or login."
}
```

---

## User Login

### Request: Successful Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "password123"
}
```

**Expected Response** (200 OK):
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiVVNSMDAxIiwiZW1haWwiOiJhaG1lZEBleGFtcGxlLmNvbSIsImlhdCI6MTcwOTY0MjAwMCwiZXhwIjoxNzEwMjQ2ODAwfQ.abc123xyz",
  "user": {
    "user_id": "USR001",
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "current_city": "Cairo"
  }
}
```

---

### Request: Login with Invalid Password

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "wrongpassword"
}
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "Invalid email or password"
}
```

---

### Request: Login with Non-existent Email

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "nonexistent@example.com",
  "password": "password123"
}
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "Invalid email or password"
}
```

---

### Request: Missing Email or Password

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Email and password are required"
}
```

---

## Update User Location

### Request: Update Location (Authenticated)

First, login to get a token, then use it:

```http
PUT /api/auth/location
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiVVNSMDAxIiwiZW1haWwiOiJhaG1lZEBleGFtcGxlLmNvbSIsImlhdCI6MTcwOTY0MjAwMCwiZXhwIjoxNzEwMjQ2ODAwfQ.abc123xyz

{
  "latitude": 25.6872,
  "longitude": 32.6396
}
```

**Expected Response** (200 OK):
```json
{
  "message": "Location updated successfully",
  "user": {
    "user_id": "USR001",
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "current_city": "Luxor",
    "latitude": 25.6872,
    "longitude": 32.6396
  }
}
```

---

### Request: Update Location without Token

```http
PUT /api/auth/location
Content-Type: application/json

{
  "latitude": 25.6872,
  "longitude": 32.6396
}
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "No token provided"
}
```

---

### Request: Update Location with Invalid Token

```http
PUT /api/auth/location
Content-Type: application/json
Authorization: Bearer invalid_token_here

{
  "latitude": 25.6872,
  "longitude": 32.6396
}
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "Invalid token"
}
```

---

### Request: Update Location Missing Coordinates

```http
PUT /api/auth/location
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiVVNSMDAxIiwiZW1haWwiOiJhaG1lZEBleGFtcGxlLmNvbSIsImlhdCI6MTcwOTY0MjAwMCwiZXhwIjoxNzEwMjQ2ODAwfQ.abc123xyz

{
  "latitude": 25.6872
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Latitude and longitude are required"
}
```

---

## Health Check

### Request: Server Health

```http
GET /
```

**Expected Response** (200 OK):
```json
{
  "message": "TourMate API is running"
}
```

---

## Testing Script (cURL)

Save this script to test all endpoints:

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

echo "Testing TourMate API..."

# Test 1: Health Check
echo -e "\n${GREEN}Test 1: Health Check${NC}"
curl -X GET "$BASE_URL/"

# Test 2: Register User
echo -e "\n${GREEN}Test 2: Register User${NC}"
REGISTER_RESPONSE=$(curl -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "latitude": 30.0444,
    "longitude": 31.2357
  }')
echo "$REGISTER_RESPONSE"

# Extract token from login
echo -e "\n${GREEN}Test 3: Login User${NC}"
LOGIN_RESPONSE=$(curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')
echo "$LOGIN_RESPONSE"
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test 4: Update Location
echo -e "\n${GREEN}Test 4: Update Location${NC}"
curl -X PUT "$BASE_URL/api/auth/location" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "latitude": 31.2001,
    "longitude": 29.9187
  }'

echo -e "\n${GREEN}All tests completed!${NC}"
```

Run with:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Integration with Frontend

### Example React/React Native Code

```javascript
// Register
const registerResponse = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Ahmed',
    email: 'ahmed@example.com',
    password: 'password123',
    latitude: 30.0444,
    longitude: 31.2357
  })
});

const newUser = await registerResponse.json();
console.log('User ID:', newUser.user.user_id);

// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ahmed@example.com',
    password: 'password123'
  })
});

const { token, user } = await loginResponse.json();
localStorage.setItem('authToken', token); // Store token

// Update Location
const updateResponse = await fetch('http://localhost:3000/api/auth/location', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    latitude: 31.2001,
    longitude: 29.9187
  })
});

const updatedUser = await updateResponse.json();
console.log('Current city:', updatedUser.user.current_city);
```

---

## Notes

- All timestamps are in UTC
- Tokens expire in 7 days
- Passwords are hashed using bcrypt with 10 salt rounds
- User IDs are sequential (USR001, USR002, etc.)
- Location updates automatically determine the nearest Egyptian city
