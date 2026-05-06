import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import hotelsRouter from './routes/hotels.js';
import aiRouter from './routes/ai.js';
import attractionsRouter from './routes/attractions.js';
import pointsRouter from './routes/points.js';
import ttsRouter from './routes/tts.js';
import recognitionRouter from './routes/recognition.js'; 
import recommendationsRouter from './routes/recommendations.js';
import plansRouter from './routes/plans.js';
import pool from './db.js'; 

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/uploads', express.static(join(__dirname, '../uploads')));

app.use('/api/attractions', attractionsRouter);
app.use('/api/points', pointsRouter);
app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/recognition', recognitionRouter);  // ← ADD THIS
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/plans', plansRouter);

app.get('/', (req, res) => {
  res.json({ message: 'TourMate API is running' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ DB connected');

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('❌ DB connection failed:', err);
    const msg = String(err?.message || err);
    if (msg.includes('EMAXCONNSESSION') || msg.includes('max clients reached')) {
      console.error(`
Neon "session" connection limit is full. Close other DB clients (Flask, SQL editor, extra terminals),
or use Neon's pooled connection URL (host often contains "-pooler").
`);
    }
    process.exit(1);
  }
}

start();
