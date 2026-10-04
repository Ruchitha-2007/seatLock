import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './modules/auth/auth.routes.js';
import movieRoutes from './modules/movies/movies.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import demandsRoutes from './modules/demands/demands.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();

// 1. HTTP Security Headers with Helmet
app.use(helmet());

// 2. CORS Configuration
const envOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim().replace(/\/$/, ''))
  : [];
const allowedOrigins = [
  ...envOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }
    // Return true for local development to prevent network errors
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

// 3. Request Logging & Body Parsing (Strict payload limit to prevent DoS)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Global Rate Limiter
app.use(generalLimiter);

// 5. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'SeatLock Concurrency Engine',
  });
});

// 6. Application Routes
app.use('/api/auth', authRoutes);
app.use('/api', movieRoutes);
app.use('/api', bookingRoutes);
app.use('/api', demandsRoutes);
app.use('/api', adminRoutes);

// 7. 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot find route ${req.method} ${req.originalUrl} on this server.`,
  });
});

// 8. Centralized Error Handler
app.use(errorHandler);

export default app;
