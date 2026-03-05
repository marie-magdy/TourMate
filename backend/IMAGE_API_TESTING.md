# Image Management API - Testing Guide

## Quick Start

**Base URL:** `http://localhost:3000`

**Authentication:** All image endpoints require JWT token in Authorization header

```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Register & Login (Get JWT Token)

### Register New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "user_id": "USR011",
    "name": "Test User",
    "email": "test@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login Existing User

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.mitchell@tourmate.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "user_id": "USR001",
    "name": "Sarah Mitchell",
    "email": "sarah.mitchell@tourmate.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the token** for use in following requests.

---

## 2. Upload Image for Attraction

### Basic Upload

```bash
TOKEN="your_jwt_token_here"
ATTRACTION_ID="ATT001"

curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/your/image.jpg"
```

### Upload with PowerShell (Windows)

```powershell
$token = "your_jwt_token_here"
$attractionId = "ATT001"
$imagePath = "C:\Users\DELL\Pictures\myimage.jpg"

$headers = @{
    "Authorization" = "Bearer $token"
}

$form = @{
    image = Get-Item -Path $imagePath
}

Invoke-WebRequest -Uri "http://localhost:3000/api/images/attractions/$attractionId" `
    -Method Post `
    -Headers $headers `
    -Form $form
```

### Upload with JavaScript/Fetch API

```javascript
const token = "your_jwt_token_here";
const attractionId = "ATT001";
const file = document.getElementById("fileInput").files[0];

const formData = new FormData();
formData.append("image", file);

const response = await fetch(
  `http://localhost:3000/api/images/attractions/${attractionId}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  }
);

const data = await response.json();
console.log(data);
```

### Response (Success - 201)

```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageId": 25,
    "attractionId": "ATT001",
    "imageUrl": "http://localhost:3000/uploads/attraction-ATT001-1708934567890-abc123.jpg",
    "filename": "attraction-ATT001-1708934567890-abc123.jpg",
    "createdAt": "2024-02-26T10:30:00Z"
  }
}
```

### Response (Error - 400)

```json
{
  "success": false,
  "error": "Attraction not found"
}
```

**Error Codes:**
- `400` - Attraction not found / No file uploaded / Invalid file type
- `413` - File too large (max 5MB)
- `500` - Server error

---

## 3. Get Images for Attraction

### Get All Images

```bash
TOKEN="your_jwt_token_here"
ATTRACTION_ID="ATT001"

curl -X GET http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN"
```

### With JavaScript/Fetch API

```javascript
const token = "your_jwt_token_here";
const attractionId = "ATT001";

const response = await fetch(
  `http://localhost:3000/api/images/attractions/${attractionId}`,
  {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log("Images:", data.images);

// Display images
data.images.forEach(image => {
  console.log(`Image ID: ${image.imageId}`);
  console.log(`URL: ${image.imageUrl}`);
  console.log(`Uploaded: ${image.createdAt}`);
});
```

### Response (Success - 200)

```json
{
  "success": true,
  "attractionId": "ATT001",
  "totalImages": 4,
  "images": [
    {
      "imageId": 1,
      "attractionId": "ATT001",
      "imageUrl": "http://localhost:3000/uploads/attraction-ATT001-1.jpg",
      "filename": "attraction-ATT001-1.jpg",
      "createdAt": "2024-02-26T08:00:00Z"
    },
    {
      "imageId": 2,
      "attractionId": "ATT001",
      "imageUrl": "http://localhost:3000/uploads/attraction-ATT001-2.jpg",
      "filename": "attraction-ATT001-2.jpg",
      "createdAt": "2024-02-26T09:15:00Z"
    },
    {
      "imageId": 3,
      "attractionId": "ATT001",
      "imageUrl": "http://localhost:3000/uploads/attraction-ATT001-3.jpg",
      "filename": "attraction-ATT001-3.jpg",
      "createdAt": "2024-02-26T10:30:00Z"
    },
    {
      "imageId": 25,
      "attractionId": "ATT001",
      "imageUrl": "http://localhost:3000/uploads/attraction-ATT001-1708934567890-abc123.jpg",
      "filename": "attraction-ATT001-1708934567890-abc123.jpg",
      "createdAt": "2024-02-26T10:45:00Z"
    }
  ]
}
```

### Response (Error - 404)

```json
{
  "success": false,
  "error": "Attraction not found"
}
```

---

## 4. Delete Image

### Delete Specific Image

```bash
TOKEN="your_jwt_token_here"
IMAGE_ID="25"

curl -X DELETE http://localhost:3000/api/images/$IMAGE_ID \
  -H "Authorization: Bearer $TOKEN"
```

### With JavaScript/Fetch API

```javascript
const token = "your_jwt_token_here";
const imageId = 25;

const response = await fetch(
  `http://localhost:3000/api/images/${imageId}`,
  {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

const data = await response.json();
if (data.success) {
  console.log("Image deleted successfully");
}
```

### Response (Success - 200)

```json
{
  "success": true,
  "message": "Image deleted successfully",
  "deletedImageId": 25
}
```

### Response (Error - 404)

```json
{
  "success": false,
  "error": "Image not found"
}
```

---

## 5. Direct Image Access

### View Image in Browser

Simply visit the image URL in your browser:

```
http://localhost:3000/uploads/attraction-ATT001-1708934567890-abc123.jpg
```

### Download Image with cURL

```bash
curl -o myimage.jpg http://localhost:3000/uploads/attraction-ATT001-1.jpg
```

### Download with Postman

1. Open Postman
2. Select GET method
3. Enter URL: `http://localhost:3000/uploads/attraction-ATT001-1.jpg`
4. Click Send
5. Click "Save Response" → "Save to a file"

---

## Complete Workflow Example

### Scenario: Upload and Manage Images for an Attraction

#### Step 1: Login and Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.mitchell@tourmate.com",
    "password": "password123"
  }' | jq -r '.token'
```

Save the token:
```bash
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.mitchell@tourmate.com",
    "password": "password123"
  }' | jq -r '.token')

echo $TOKEN  # Should print your JWT token
```

#### Step 2: Upload Multiple Images

```bash
ATTRACTION_ID="ATT002"

# Upload image 1
curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@image1.jpg"

# Upload image 2
curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@image2.jpg"

# Upload image 3
curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@image3.jpg"
```

#### Step 3: Retrieve All Images

```bash
curl -X GET http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

#### Step 4: Display Images in Application

```javascript
// Get all images
const images = await fetch(
  `/api/images/attractions/ATT002`,
  { headers: { Authorization: `Bearer ${token}` } }
).then(r => r.json());

// Show gallery
images.images.forEach((img, index) => {
  const img_elem = document.createElement('img');
  img_elem.src = img.imageUrl;
  img_elem.alt = `Image ${index + 1}`;
  img_elem.style.width = '300px';
  img_elem.style.margin = '10px';
  document.body.appendChild(img_elem);
});
```

#### Step 5: Delete Unwanted Image

```bash
# Get image ID from the list above
IMAGE_ID=25

curl -X DELETE http://localhost:3000/api/images/$IMAGE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing with Postman

### 1. Create New Request

- Method: `POST`
- URL: `http://localhost:3000/api/images/attractions/ATT001`

### 2. Set Authorization

- Tab: Authorization
- Type: Bearer Token
- Token: Paste your JWT token

### 3. Add File

- Tab: Body
- Select: form-data
- Key: `image` (type: File)
- Value: Select your image file

### 4. Send Request

Click Send button. Response will show image details.

---

## Common Issues & Solutions

### Issue: "401 Unauthorized"

**Problem:** Missing or invalid JWT token

**Solution:**
```bash
# Get a fresh token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.mitchell@tourmate.com",
    "password": "password123"
  }'
```

### Issue: "413 Payload Too Large"

**Problem:** File exceeds 5MB limit

**Solution:** Compress the image before uploading

```bash
# On Mac/Linux with ImageMagick
convert image.jpg -resize 1920x1080 compressed.jpg

# On Windows with ImageMagick
magick convert image.jpg -resize 1920x1080 compressed.jpg
```

### Issue: "400 Invalid File Type"

**Problem:** File format not supported

**Solution:** Use one of these formats:
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Issue: Image Upload Succeeds but Can't Access URL

**Problem:** Static file serving not configured

**Solution:** Verify `src/index.js` has:
```javascript
app.use('/uploads', express.static(path.join(uploadPath, '/uploads')));
```

---

## Testing Attractions with Existing Images

These attractions already have sample images:

```bash
TOKEN="your_jwt_token_here"

# Get images for Great Pyramid (3 images)
curl -X GET http://localhost:3000/api/images/attractions/ATT001 \
  -H "Authorization: Bearer $TOKEN"

# Get images for Egyptian Museum (2 images)
curl -X GET http://localhost:3000/api/images/attractions/ATT002 \
  -H "Authorization: Bearer $TOKEN"

# Get images for Karnak Temple Complex (3 images)
curl -X GET http://localhost:3000/api/images/attractions/ATT039 \
  -H "Authorization: Bearer $TOKEN"

# Get images for Valley of the Kings (2 images)
curl -X GET http://localhost:3000/api/images/attractions/ATT041 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Advanced: Batch Operations

### Upload Multiple Images (Bash Script)

```bash
#!/bin/bash

TOKEN="your_jwt_token_here"
ATTRACTION_ID="ATT001"
IMAGE_DIR="/path/to/images"

for image_file in $IMAGE_DIR/*.{jpg,png,gif,webp}; do
    if [ -f "$image_file" ]; then
        echo "Uploading: $image_file"
        curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
            -H "Authorization: Bearer $TOKEN" \
            -F "image=@$image_file"
        echo ""
    fi
done
```

### Get All Attractions' Primary Images

```bash
TOKEN="your_jwt_token_here"

# Attractions with pre-seeded images
for attraction in ATT001 ATT002 ATT003 ATT005 ATT014 ATT017 ATT034 ATT039 ATT041 ATT049 ATT071; do
    echo "=== Attraction $attraction ==="
    curl -s -X GET http://localhost:3000/api/images/attractions/$attraction \
        -H "Authorization: Bearer $TOKEN" | jq '.images[0]'
    echo ""
done
```

---

## Performance Testing

### Measure Upload Speed

```bash
TOKEN="your_jwt_token_here"
ATTRACTION_ID="ATT001"

# Upload and time the request
time curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@large_image.jpg"
```

### Load Test: Upload Multiple Concurrent Requests

```bash
TOKEN="your_jwt_token_here"
ATTRACTION_ID="ATT001"

# Upload 10 images concurrently
for i in {1..10}; do
    (curl -X POST http://localhost:3000/api/images/attractions/$ATTRACTION_ID \
      -H "Authorization: Bearer $TOKEN" \
      -F "image=@image.jpg") &
done

wait
echo "All uploads completed"
```

---

## Debugging

### Enable Detailed Logging

Check backend console output for request logs:

```bash
# Terminal 1: Start backend in debug mode
NODE_ENV=development npm start

# Terminal 2: Make request
curl -v -X POST http://localhost:3000/api/images/attractions/ATT001 \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@image.jpg"
```

### Query Database Directly

```bash
# Connect to PostgreSQL
psql -U youruser -d tourmate_db

# View all images
SELECT * FROM attraction_images;

# View images for specific attraction
SELECT * FROM attraction_images WHERE attraction_id = 'ATT001';

# Count total images
SELECT COUNT(*) FROM attraction_images;

# View images with count per attraction
SELECT attraction_id, COUNT(*) as image_count 
FROM attraction_images 
GROUP BY attraction_id 
ORDER BY image_count DESC;
```

---

## Next Steps

1. ✅ Test all endpoints with provided examples
2. ✅ Integrate image upload into your frontend
3. ✅ Add image gallery/carousel UI components
4. ✅ Implement image optimization before upload
5. 📋 Consider cloud storage (S3, Cloudinary) for production
6. 📋 Add image thumbnails generation
7. 📋 Implement image moderation/filtering

