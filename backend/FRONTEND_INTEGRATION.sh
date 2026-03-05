#!/bin/bash

# TourMate Frontend Integration Guide
# How to use the new backend features in your React Native/Expo app

## ============================================================
## NEW FEATURES OVERVIEW
## ============================================================

### 1. Sequential User IDs
- Instead of: 550e8400-e29b-41d4-a716-446655440000 (UUID)
- Now using: USR001, USR002, USR003, etc.
- Benefits: Easy to remember, easy to track, human-readable

### 2. Geolocation-Based City Assignment
- When registering, send user's coordinates
- Backend automatically detects nearest Egyptian city
- No need to show dropdown - it's automatic!
- Falls back to Cairo if no location provided

### 3. Location Update Endpoint
- New endpoint: PUT /api/auth/location
- Update user's city when they move
- Requires JWT authentication

---

## ============================================================
## INTEGRATION CODE EXAMPLES
## ============================================================

### React Native with Expo Location

#### 1. Install Expo Location
```bash
expo install expo-location
```

#### 2. Get User Location
```javascript
import * as Location from 'expo-location';

async function getUserLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.log('Permission to access location was denied');
    return null;
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

// Usage:
const location = await getUserLocation();
// Returns: { latitude: 30.0444, longitude: 31.2357 }
```

#### 3. Register with Location
```javascript
import * as Location from 'expo-location';

async function registerWithLocation(name, email, password) {
  try {
    // Get user's location
    const location = await getUserLocation();

    // Register with location
    const response = await fetch('http://your-api.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        latitude: location?.latitude,
        longitude: location?.longitude,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Registered successfully!');
      console.log('User ID:', data.user.user_id);        // USR001
      console.log('Current City:', data.user.current_city); // Cairo
      return data.user;
    } else {
      console.error('Registration failed:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Registration error:', error);
    return null;
  }
}

// Usage in signup screen:
const user = await registerWithLocation(
  'Ahmed Hassan',
  'ahmed@example.com',
  'password123'
);
// Automatically detects city based on location!
```

#### 4. Login and Store Token
```javascript
async function login(email, password) {
  try {
    const response = await fetch('http://your-api.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store token using AsyncStorage
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('userId', data.user.user_id);
      await AsyncStorage.setItem('currentCity', data.user.current_city);

      console.log('User ID:', data.user.user_id);
      return data.user;
    } else {
      console.error('Login failed:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// Usage:
const user = await login('ahmed@example.com', 'password123');
```

#### 5. Update User Location
```javascript
async function updateUserLocation() {
  try {
    // Get current token
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.error('No authentication token found');
      return null;
    }

    // Get location
    const location = await getUserLocation();
    if (!location) {
      console.error('Could not get location');
      return null;
    }

    // Update location on backend
    const response = await fetch('http://your-api.com/api/auth/location', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Location updated!');
      console.log('New city:', data.user.current_city);

      // Update local storage
      await AsyncStorage.setItem('currentCity', data.user.current_city);

      return data.user;
    } else {
      console.error('Update failed:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Update location error:', error);
    return null;
  }
}

// Usage - call periodically or when user navigates
updateUserLocation();
```

#### 6. Create Reusable API Service
```javascript
// api/authApi.ts or authApi.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const API_BASE_URL = 'http://your-api.com/api/auth';

// Helper function to get location
async function getCurrentLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Location error:', error);
    return null;
  }
}

// Get stored token
async function getAuthToken() {
  return await AsyncStorage.getItem('authToken');
}

// Register
export async function register(name, email, password) {
  try {
    const location = await getCurrentLocation();

    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        latitude: location?.latitude,
        longitude: location?.longitude,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    return data.user;
  } catch (error) {
    throw error;
  }
}

// Login
export async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    // Store token
    await AsyncStorage.setItem('authToken', data.token);
    await AsyncStorage.setItem('userId', data.user.user_id);
    await AsyncStorage.setItem('currentCity', data.user.current_city);

    return data.user;
  } catch (error) {
    throw error;
  }
}

// Update Location
export async function updateLocation() {
  try {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const location = await getCurrentLocation();
    if (!location) throw new Error('Could not get location');

    const response = await fetch(`${API_BASE_URL}/location`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(location),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    // Update local city
    await AsyncStorage.setItem('currentCity', data.user.current_city);

    return data.user;
  } catch (error) {
    throw error;
  }
}

// Logout
export async function logout() {
  await AsyncStorage.removeItem('authToken');
  await AsyncStorage.removeItem('userId');
  await AsyncStorage.removeItem('currentCity');
}

// Get current user ID
export async function getCurrentUserId() {
  return await AsyncStorage.getItem('userId');
}

// Get current city
export async function getCurrentCity() {
  return await AsyncStorage.getItem('currentCity');
}
```

#### 7. Use in App Component

```javascript
// app/index.tsx or screens/HomeScreen.tsx

import { useEffect, useState } from 'react';
import {
  register,
  login,
  updateLocation,
  getCurrentUserId,
  getCurrentCity,
} from '../api/authApi';

export default function HomeScreen() {
  const [userId, setUserId] = useState(null);
  const [currentCity, setCurrentCity] = useState(null);
  const [loading, setLoading] = useState(false);

  // Update location on app startup
  useEffect(() => {
    updateUserLocationOnStartup();
    loadUserInfo();
  }, []);

  const updateUserLocationOnStartup = async () => {
    try {
      await updateLocation();
      await loadUserInfo();
    } catch (error) {
      console.log('Location update failed (might not be authenticated):', error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const id = await getCurrentUserId();
      const city = await getCurrentCity();
      setUserId(id);
      setCurrentCity(city);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const handleSignup = async (name, email, password) => {
    try {
      setLoading(true);
      const user = await register(name, email, password);
      console.log('Welcome', user.name, 'from', user.current_city);
      await loadUserInfo();
    } catch (error) {
      console.error('Signup failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      setLoading(true);
      const user = await login(email, password);
      console.log('Welcome back,', user.name);
      await loadUserInfo();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text>User ID: {userId}</Text>
      <Text>City: {currentCity}</Text>

      {/* Your signup/login UI here */}
      {/* Call handleSignup or handleLogin */}
    </View>
  );
}
```

---

## ============================================================
## API RESPONSE EXAMPLES
## ============================================================

### Registration Response
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

### Login Response
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "USR001",
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "current_city": "Cairo"
  }
}
```

### Location Update Response
```json
{
  "message": "Location updated successfully",
  "user": {
    "user_id": "USR001",
    "name": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "current_city": "Alexandria",
    "latitude": 31.2001,
    "longitude": 29.9187
  }
}
```

---

## ============================================================
## KEY POINTS FOR FRONTEND
## ============================================================

### What Changed
✅ User IDs are now sequential (USR001, USR002, etc.)  
✅ City is set automatically based on location  
✅ New endpoint to update location  
✅ All existing functionality still works  

### What Didn't Change
✅ Login/Register endpoints still work the same  
✅ Password requirements still the same  
✅ JWT token format unchanged  
✅ Error handling unchanged  

### Supported Egyptian Cities
Cairo, Alexandria, Giza, Aswan, Luxor, South Sinai, Red Sea,
Ismailia, Fayoum, New Valley, North Coast, Matrouh, Abu Simbel

### Token Validity
- Expires in 7 days
- Refresh by logging in again
- Include in Authorization header as: "Bearer {token}"

---

## ============================================================
## TESTING IN DEVELOPMENT
## ============================================================

### Test with Mock Data (No Real Location)
```javascript
// Mock location for testing
const mockLocation = {
  latitude: 31.2001,  // Alexandria
  longitude: 29.9187,
};

const user = await register(
  'Test User',
  'test@example.com',
  'password123'
);
// Will assign Alexandria as city
```

### Monitor Network Requests
```javascript
// Use Expo's built-in network debugging
// or use a tool like Charles/Fiddler

// Check backend logs:
// npm run dev → shows all API requests
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Email already registered" | Use different email |
| "No token provided" | Make sure you're logged in |
| "Invalid token" | Token expired - login again |
| City not detected | Check coordinates are in Egypt |
| Location permission denied | Ask user for permission again |

---

## ============================================================
## BEST PRACTICES
## ============================================================

✓ Always request location permission before using location
✓ Store token securely (never in plain text)
✓ Refresh location periodically (e.g., every 5-10 minutes)
✓ Handle errors gracefully
✓ Show user feedback during requests (loading state)
✓ Cache user info locally
✓ Validate email format before sending
✓ Use HTTPS in production (enforced)
✓ Never log sensitive data (tokens, passwords)

---

## ============================================================
## HELPFUL LINKS
## ============================================================

- Backend Documentation: `ARCHITECTURE.md`
- API Testing Examples: `API_TESTING.md`
- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
- AsyncStorage: https://react-native-async-storage.github.io/
- JWT Info: https://jwt.io

---

## ============================================================
## READY TO USE!
## ============================================================

The backend is fully implemented and ready for frontend integration.

For questions about the backend:
1. Check ARCHITECTURE.md
2. Check API_TESTING.md
3. Review the implementation examples above

Good luck with the integration! 🎉

---

Last Updated: March 5, 2026
