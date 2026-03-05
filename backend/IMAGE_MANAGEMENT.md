# Image Management System - TourMate Backend

## Overview

The Image Management System allows attractions to have multiple images stored as URLs in the database. Each attraction can have unlimited images, with the first uploaded image serving as the primary/featured image.

## Architecture

### Database Schema

**Table: `attraction_images`**
- `id` (SERIAL PRIMARY KEY) - Auto-incremented unique identifier
- `attraction_id` (VARCHAR) - Foreign key referencing `attractions.attraction_id`
- `image_url` (VARCHAR) - Full URL path to the image (e.g., `http://localhost:3000/uploads/attraction-ATT001-1.jpg`)
- `filename` (VARCHAR) - Original filename of the uploaded image
- `created_at` (TIMESTAMP) - Auto-populated creation timestamp
- `updated_at` (TIMESTAMP) - Auto-populated last update timestamp

**Constraints:**
- Foreign key constraint with CASCADE delete on attractions
- UNIQUE constraint on (attraction_id, filename) to prevent duplicate uploads
- Index on attraction_id for faster queries

### File Structure

```
backend/
├── config/
│   └── multer.js           # File upload configuration
├── controllers/
│   └── imageController.js  # HTTP request handlers
├── services/
│   └── imageService.js     # Business logic for image operations
├── src/
│   ├── routes/
│   │   └── images.js       # Image API endpoints
│   ├── createImageTable.js # Database migration
│   ├── index.js            # Main app with image routes
│   └── init.js             # Database initialization with sample images
├── uploads/                # Directory for storing image files
└── IMAGE_MANAGEMENT.md     # This file
```

## API Endpoints

### 1. Upload Image for Attraction

**Endpoint:** `POST /api/images/attractions/:attractionId`

**Description:** Upload a single image file for an attraction.

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

**Request Body:**
```
form-data:
  image: <file> (JPEG, JPG, PNG, GIF, or WEBP, max 5MB)
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageId": 1,
    "attractionId": "ATT001",
    "imageUrl": "http://localhost:3000/uploads/attraction-ATT001-1708934567890-abc123.jpg",
    "filename": "attraction-ATT001-1708934567890-abc123.jpg",
    "createdAt": "2024-02-26T10:30:00Z"
  }
}
```

**Response Errors:**
- `400` - Attraction not found
- `400` - No file uploaded
- `400` - Invalid file type (only JPEG, JPG, PNG, GIF, WEBP allowed)
- `413` - File too large (max 5MB)
- `500` - Server error

**Example Request (cURL):**
```bash
curl -X POST http://localhost:3000/api/images/attractions/ATT001 \
  -H "Authorization: Bearer <token>" \
  -F "image=@/path/to/image.jpg"
```

---

### 2. Get All Images for Attraction

**Endpoint:** `GET /api/images/attractions/:attractionId`

**Description:** Retrieve all images for a specific attraction.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "attractionId": "ATT001",
  "totalImages": 3,
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
    }
  ]
}
```

**Response Errors:**
- `404` - Attraction not found
- `500` - Server error

**Example Request (cURL):**
```bash
curl -X GET http://localhost:3000/api/images/attractions/ATT001 \
  -H "Authorization: Bearer <token>"
```

---

### 3. Delete Image

**Endpoint:** `DELETE /api/images/:imageId`

**Description:** Delete a specific image by ID.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "deletedImageId": 1
}
```

**Response Errors:**
- `404` - Image not found
- `500` - Server error

**Example Request (cURL):**
```bash
curl -X DELETE http://localhost:3000/api/images/1 \
  -H "Authorization: Bearer <token>"
```

---

## Image Upload Configuration

**File:** `config/multer.js`

**Key Settings:**
- **Destination:** `/uploads` folder (relative to backend directory)
- **File Naming:** `attraction-<attractionId>-<timestamp>-<random>.ext`
- **Max File Size:** 5MB
- **Allowed Formats:** JPEG, JPG, PNG, GIF, WEBP
- **Storage:** Disk storage (local filesystem)

**How It Works:**
1. User uploads file via multipart/form-data
2. Multer validates file type and size
3. File is saved to `/uploads/` with timestamped filename
4. URL is generated as `http://localhost:3000/uploads/<filename>`
5. URL and metadata are stored in database

---

## Service Layer

**File:** `services/imageService.js`

### Core Functions

#### 1. `uploadAttractionImage(attractionId, filename, baseUrl)`
Uploads and stores image URL in database.

```javascript
const result = await uploadAttractionImage('ATT001', 'attraction-ATT001-1-abc.jpg', 'http://localhost:3000');
// Returns: { imageId: 1, attractionId: 'ATT001', imageUrl: '...', filename: '...' }
```

#### 2. `getAttractionImages(attractionId)`
Retrieves all images for an attraction.

```javascript
const images = await getAttractionImages('ATT001');
// Returns: [ { imageId, attractionId, imageUrl, filename, createdAt }, ... ]
```

#### 3. `getPrimaryImage(attractionId)`
Gets the first image (primary/featured image) for an attraction.

```javascript
const primary = await getPrimaryImage('ATT001');
// Returns: { imageId, attractionId, imageUrl, filename, createdAt }
```

#### 4. `deleteImage(imageId)`
Deletes an image record from database.

```javascript
await deleteImage(1);
// Returns success or throws error
```

#### 5. `getMultipleAttractionsImages(attractionIds)`
Batch fetch images for multiple attractions (useful for attraction listing).

```javascript
const imagesMap = await getMultipleAttractionsImages(['ATT001', 'ATT002', 'ATT003']);
// Returns: { ATT001: [{...}, {...}], ATT002: [{...}], ... }
```

---

## Controller Layer

**File:** `controllers/imageController.js`

### Handlers

#### 1. `uploadImage(req, res)`
HTTP POST handler for `/api/images/attractions/:attractionId`
- Validates attraction exists
- Validates file upload
- Calls imageService to save URL
- Returns uploaded image details

#### 2. `getImages(req, res)`
HTTP GET handler for `/api/images/attractions/:attractionId`
- Validates attraction exists
- Retrieves all images from service
- Returns paginated image list

#### 3. `deleteImageHandler(req, res)`
HTTP DELETE handler for `/api/images/:imageId`
- Validates image exists
- Soft delete from database
- Returns success response

---

## Routes

**File:** `src/routes/images.js`

```javascript
POST   /api/images/attractions/:attractionId  - Upload image
GET    /api/images/attractions/:attractionId  - Get all images for attraction
DELETE /api/images/:imageId                    - Delete image
```

---

## Static File Serving

**Location:** `src/index.js`

Images are served as static files via Express middleware:

```javascript
app.use('/uploads', express.static(path.join(uploadPath, '/uploads')));
```

This allows images to be accessed directly via URLs like:
- `http://localhost:3000/uploads/attraction-ATT001-1.jpg`

---

## Integration with Frontend

### React Native/Expo Example

```typescript
// Fetch attraction with all images
const response = await fetch(`http://localhost:3000/api/images/attractions/ATT001`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Render images
{data.images.map((image) => (
  <Image 
    key={image.imageId}
    source={{ uri: image.imageUrl }}
    style={{ width: 300, height: 200 }}
  />
))}
```

### Display Primary Image (Gallery Cover)

```typescript
// Get first image
const primaryImage = data.images[0];
<Image 
  source={{ uri: primaryImage.imageUrl }}
  style={{ width: '100%', height: 250 }}
/>
```

### Multi-Image Carousel

```typescript
import { ScrollView, Image, View } from 'react-native';

<ScrollView horizontal pagingEnabled>
  {data.images.map((image) => (
    <View key={image.imageId} style={{ width: 300, height: 250 }}>
      <Image 
        source={{ uri: image.imageUrl }}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  ))}
</ScrollView>
```

---

## Sample Database Data

The system is pre-populated with sample images for popular attractions:

- **ATT001** (Great Pyramid): 3 images
- **ATT002** (Egyptian Museum): 2 images
- **ATT003** (Khan el-Khalili): 2 images
- **ATT005** (Citadel): 2 images
- Plus images for 10+ other major attractions

Access sample images: `http://localhost:3000/uploads/attraction-<ATTRACTION_ID>-<N>.jpg`

---

## Error Handling

### Multer Errors (Handled in index.js)

```javascript
// File size exceeded
if (err.code === 'LIMIT_FILE_SIZE') {
  return res.status(413).json({
    success: false,
    error: 'File too large. Maximum size is 5MB.'
  });
}

// Invalid file type
if (err.code === 'FILE_TYPE_REJECTED') {
  return res.status(400).json({
    success: false,
    error: 'Invalid file type. Only JPEG, JPG, PNG, GIF, and WEBP are allowed.'
  });
}
```

### Database Errors

- **Duplicate filename:** Returns 400 with message
- **Attraction not found:** Returns 404
- **Database connection:** Returns 500

---

## Testing the System

### 1. Test Image Upload

```bash
# Upload image for attraction ATT001
curl -X POST http://localhost:3000/api/images/attractions/ATT001 \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "image=@/path/to/your/image.jpg"
```

### 2. Test Retrieve Images

```bash
# Get all images for ATT001
curl http://localhost:3000/api/images/attractions/ATT001 \
  -H "Authorization: Bearer <your_jwt_token>"
```

### 3. Test Delete Image

```bash
# Delete image with ID 1
curl -X DELETE http://localhost:3000/api/images/1 \
  -H "Authorization: Bearer <your_jwt_token>"
```

### 4. Test Static File Access

```bash
# Access uploaded image directly
curl http://localhost:3000/uploads/attraction-ATT001-1708934567890-abc123.jpg -o image.jpg
```

---

## Troubleshooting

### Issue: "LIMIT_FILE_SIZE" Error
**Solution:** File size exceeds 5MB. Compress image or reduce file size.

### Issue: "FILE_TYPE_REJECTED" Error
**Solution:** File type not supported. Use JPEG, JPG, PNG, GIF, or WEBP.

### Issue: 404 on Image URL
**Solution:** Check that:
1. `/uploads` folder exists in backend directory
2. Static middleware is configured in `src/index.js`
3. Image URL format is correct

### Issue: Database Connection Error
**Solution:**
1. Verify PostgreSQL is running
2. Check `.env` file has correct DB credentials
3. Run `npm run init-db` to initialize database

### Issue: UNIQUE Constraint Violation
**Solution:** Cannot upload same filename twice for same attraction. Filenames include timestamp so duplicates are unlikely unless uploading very quickly.

---

## Performance Considerations

### Optimizations Implemented

1. **Database Indexes:** Index on `attraction_id` for fast lookups
2. **File Naming:** Timestamps prevent collisions
3. **Static Serving:** Direct file serving without processing
4. **Batch Queries:** `getMultipleAttractionsImages()` for listing pages

### Recommendations

1. **Image Optimization Frontend:** Compress images before uploading
2. **CDN Integration:** Consider S3 or Cloudinary for image hosting
3. **Caching:** Implement Redis caching for frequently accessed images
4. **Cleanup:** Archive old/deleted images periodically

---

## Migration Details

**File:** `src/createImageTable.js`

The migration function creates:
1. `attraction_images` table with proper schema
2. UNIQUE constraint on (attraction_id, filename)
3. CASCADE delete on attraction removal
4. Index on attraction_id for performance

Automatically called during database initialization via `npm run init-db`.

---

## Security Notes

1. **File Upload Validation:** Only specific image formats allowed
2. **Size Limits:** Max 5MB per image to prevent storage abuse
3. **Authentication:** All endpoints require JWT token
4. **SQL Injection:** Using parameterized queries
5. **CORS:** Configure as needed for frontend domain

---

## Future Enhancements

1. **Image Processing:** Auto-resize/compress on upload
2. **Cloud Storage:** Move to S3/Google Cloud Storage
3. **Image Metadata:** Extract and store EXIF data
4. **Batch Upload:** Multiple files in single request
5. **Image Moderation:** AI-based content review
6. **Thumbnail Generation:** Auto-create thumbnails for listings

---

## Related Documentation

- [Authentication & Authorization System](./AUTHENTICATION.md)
- [API Testing Guide](./API_TESTING.md)
- [Database Schema](./DATABASE.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

## Support

For issues or questions:
1. Check logs: `npm run init-db` for database issues
2. Verify routes: Check `src/routes/images.js`
3. Test endpoints: Use provided cURL examples
4. Check database: Query `SELECT * FROM attraction_images;`

