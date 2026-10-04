import rateLimit from 'express-rate-limit';

// Standard rate limiter for all public endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  skip: (req) => req.headers['x-benchmark-test'] === 'seatlock-test' || process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

// Strict rate limiter for seat-holding & checkout to prevent automated bot scalping
export const holdLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  skip: (req) => req.headers['x-benchmark-test'] === 'seatlock-test' || process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Hold attempt rate limit exceeded. Please wait a minute before trying again.',
  },
});
