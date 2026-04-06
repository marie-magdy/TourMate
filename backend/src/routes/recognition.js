import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import pool from '../db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const CV_SERVICE = 'http://localhost:5001';

// ── POST /api/recognition/analyze ──
router.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        // Check image exists
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'No image provided' 
            });
        }

        const model_type = req.body.model_type || 'outdoor';
        console.log('API_KEY:', process.env.API_KEY);

        // Send image to Python Flask CV service
        const form = new FormData();
        form.append('image', req.file.buffer, {
            filename: 'photo.jpg',
            contentType: req.file.mimetype
        });
        form.append('model_type', model_type);

        const cvResponse = await fetch(`${CV_SERVICE}/recognize`, {
            method: 'POST',
            headers: { 
                'x-api-key': process.env.API_KEY,
                ...form.getHeaders() 
            },
            body: form
        });

        const cvResult = await cvResponse.json();

        // Landmark not recognized clearly
        if (!cvResult.recognized) {
            return res.status(200).json({
                success: false,
                recognized: false,
                message: cvResult.message,
                confidence: cvResult.confidence
            });
        }

        // Query database for full attraction info
        const dbResult = await pool.query(
            `SELECT a.*, c.name as city_name 
             FROM attractions a
             LEFT JOIN cities c ON a.city_id = c.city_id
             WHERE a.model_label = $1`,
            [cvResult.model_label]
        );

        if (dbResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                recognized: true,
                model_label: cvResult.model_label,
                confidence: cvResult.confidence,
                attraction: null,
                message: 'Landmark recognized but not in database yet'
            });
        }

        // Return full landmark info
        return res.status(200).json({
            success: true,
            recognized: true,
            confidence: cvResult.confidence,
            model_type: model_type,
            attraction: dbResult.rows[0]
        });

    } catch (err) {
        console.error('Recognition error:', err);
        
        // CV service not running
        if (err.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'CV service not available'
            });
        }
        
        return res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// ── GET /api/recognition/health ──
router.get('/health', async (req, res) => {
    try {
        const cvResponse = await fetch(`${CV_SERVICE}/health`);
        const cvResult = await cvResponse.json();
        return res.status(200).json({
            backend: 'running',
            cv_service: cvResult
        });
    } catch (err) {
        return res.status(503).json({
            backend: 'running',
            cv_service: 'not running'
        });
    }
});

export default router;