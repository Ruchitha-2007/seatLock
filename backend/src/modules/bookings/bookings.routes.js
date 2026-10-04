import { Router } from 'express';
import {
  holdSeats,
  releaseSeats,
  confirmBooking,
  getMyBookings,
  cancelBooking,
  holdSeatsSchema,
  confirmBookingSchema,
} from './bookings.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { holdLimiter } from '../../middlewares/rateLimiter.js';

const router = Router();

// Seat hold & release
router.post('/shows/:id/hold', authenticate, holdLimiter, validate(holdSeatsSchema), holdSeats);
router.post('/shows/:id/release', authenticate, releaseSeats);

// Booking confirmation with Idempotency Key validation
router.post('/bookings/confirm', authenticate, validate(confirmBookingSchema), confirmBooking);

// Cancel reservation and release seats
router.post('/bookings/:id/cancel', authenticate, cancelBooking);

// User booking history
router.get('/bookings/my-bookings', authenticate, getMyBookings);

export default router;
