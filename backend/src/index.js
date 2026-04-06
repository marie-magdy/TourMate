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
import recognitionRouter from './routes/recognition.js';  // ← ADD THIS

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

app.get('/', (req, res) => {
  res.json({ message: 'TourMate API is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});