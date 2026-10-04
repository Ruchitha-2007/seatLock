import crypto from 'crypto';
import { z } from 'zod';
import { pool, query } from '../../config/db.js';
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from '../../services/emailService.js';

export const holdSeatsSchema = z.object({
  body: z.object({
    seatIds: z.array(z.number().int().positive())
      .min(1, 'Select at least 1 seat')
      .max(6, 'You can reserve a maximum of 6 seats at once'),
  }),
});

export const confirmBookingSchema = z.object({
  body: z.object({
    showId: z.number().int().positive(),
    seatIds: z.array(z.number().int().positive()).min(1).max(6),
    paymentMethod: z.string().optional().default('PAY_AT_THEATER'),
    customerName: z.string().optional().nullable(),
    customerPhone: z.string().optional().nullable(),
    customerEmail: z.string().optional().nullable(),
  }),
}).passthrough();

/**
 * 🔒 ATOMIC SEAT HOLD WITH PESSIMISTIC ROW-LEVEL LOCKING
 * Guarantees zero double-booking under extreme concurrency.
 */
export const holdSeats = async (req, res, next) => {
  const showId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  // Sort seat IDs ascending to enforce consistent lock acquisition order and prevent deadlocks
  const seatIds = [...req.validated.body.seatIds].sort((a, b) => a - b);
  const holdMinutes = parseInt(process.env.HOLD_TIMEOUT_MINUTES || '7', 10);

  if (isNaN(showId)) {
    return res.status(400).json({ success: false, error: 'Invalid show ID' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Acquire pessimistic row locks on requested seats for this show
    const lockQuery = `
      SELECT 
        ss.id AS show_seat_id,
        ss.seat_id,
        ss.status,
        ss.held_until,
        ss.held_by_user_id,
        s.row_label,
        s.seat_number
      FROM show_seats ss
      JOIN seats s ON ss.seat_id = s.id
      WHERE ss.show_id = $1 AND ss.seat_id = ANY($2::int[])
      ORDER BY ss.seat_id ASC
      FOR UPDATE;
    `;

    const { rows: lockedSeats } = await client.query(lockQuery, [showId, seatIds]);

    // Check if all requested seats exist
    if (lockedSeats.length !== seatIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'One or more selected seats do not exist for this show.',
      });
    }

    // 2. Validate availability for every locked seat
    const unavailableSeats = [];
    const now = new Date();

    for (const seat of lockedSeats) {
      const isAvailable =
        seat.status === 'AVAILABLE' ||
        (seat.status === 'HELD' && new Date(seat.held_until) < now) ||
        (seat.status === 'HELD' && seat.held_by_user_id === userId);

      if (!isAvailable) {
        unavailableSeats.push({
          seatId: seat.seat_id,
          label: `${seat.row_label}${seat.seat_number}`,
          status: seat.status,
        });
      }
    }

    if (unavailableSeats.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Conflict: One or more selected seats are no longer available.',
        unavailableSeats,
      });
    }

    // 3. Atomically update all seats to HELD with hold expiration
    const updateQuery = `
      UPDATE show_seats
      SET 
        status = 'HELD',
        held_by_user_id = $1,
        held_until = NOW() + ($2 || ' minutes')::INTERVAL,
        version = version + 1,
        updated_at = NOW()
      WHERE show_id = $3 AND seat_id = ANY($4::int[])
      RETURNING id, seat_id, held_until;
    `;

    const updateRes = await client.query(updateQuery, [userId, `${holdMinutes}`, showId, seatIds]);

    await client.query('COMMIT');

    const heldUntil = updateRes.rows[0].held_until;

    res.json({
      success: true,
      message: `Seats held successfully for ${holdMinutes} minutes.`,
      data: {
        showId,
        seatIds,
        heldUntil,
        expiresInSeconds: holdMinutes * 60,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Explicitly release user's currently held seats
 */
export const releaseSeats = async (req, res, next) => {
  const showId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  try {
    const result = await query(`
      UPDATE show_seats
      SET 
        status = 'AVAILABLE',
        held_by_user_id = NULL,
        held_until = NULL,
        version = version + 1,
        updated_at = NOW()
      WHERE show_id = $1 AND held_by_user_id = $2 AND status = 'HELD'
      RETURNING seat_id;
    `, [showId, userId]);

    res.json({
      success: true,
      message: 'Seats released successfully',
      releasedSeatsCount: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 💳 IDEMPOTENT BOOKING CONFIRMATION & PAYMENT PIPELINE
 */
export const confirmBooking = async (req, res, next) => {
  const { showId, paymentMethod, customerName, customerPhone, customerEmail } = req.validated.body;
  const seatIds = [...req.validated.body.seatIds].sort((a, b) => a - b);
  const idempotencyKey = req.headers['idempotency-key'] || ('ik_' + crypto.randomBytes(8).toString('hex'));
  const userId = req.user.id;

  // Recipient email validation (takes entered email or logged-in user email)
  const recipientEmail = (customerEmail || req.user.email || '').trim().toLowerCase();
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid email address to receive your cinema e-ticket.',
    });
  }

  // Optional 10-digit mobile number validation if provided
  let cleanPhone = '';
  if (customerPhone) {
    let rawPhone = customerPhone.toString().trim();
    if (rawPhone.startsWith('+91')) {
      rawPhone = rawPhone.slice(3);
    } else if (rawPhone.startsWith('+')) {
      rawPhone = rawPhone.slice(1);
    }
    cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (cleanPhone.length > 0 && (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone))) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 10-digit Indian mobile number (e.g., 9848012345).',
      });
    }
  }

  // 1. Idempotency Check: Return existing booking if key was already processed
  const existingPayment = await query(`
    SELECT 
      p.id AS payment_id,
      p.amount,
      p.status AS payment_status,
      b.id AS booking_id,
      b.booking_reference,
      b.created_at
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    WHERE p.idempotency_key = $1;
  `, [idempotencyKey]);

  if (existingPayment.rows.length > 0) {
    return res.status(200).json({
      success: true,
      message: 'Idempotent request: Booking already processed.',
      data: existingPayment.rows[0],
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 2. Lock the seats and verify hold ownership & time validity
    const lockSeatsQuery = `
      SELECT 
        ss.id AS show_seat_id,
        ss.seat_id,
        ss.status,
        ss.held_until,
        ss.held_by_user_id,
        s.row_label,
        s.seat_number,
        ROUND(sh.base_price * s.price_multiplier, 2) AS seat_price
      FROM show_seats ss
      JOIN seats s ON ss.seat_id = s.id
      JOIN shows sh ON ss.show_id = sh.id
      WHERE ss.show_id = $1 AND ss.seat_id = ANY($2::int[])
      ORDER BY ss.seat_id ASC
      FOR UPDATE;
    `;

    const { rows: targetSeats } = await client.query(lockSeatsQuery, [showId, seatIds]);

    if (targetSeats.length !== seatIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Seats not found for this show.' });
    }

    const now = new Date();
    for (const seat of targetSeats) {
      const isBooked = seat.status === 'BOOKED';
      const isHeldByOther =
        seat.status === 'HELD' &&
        seat.held_by_user_id !== userId &&
        new Date(seat.held_until) > now;

      if (isBooked || isHeldByOther) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: `Seat ${seat.row_label}${seat.seat_number} is no longer available. Please select another seat.`,
        });
      }
    }

    // 3. Calculate total amount
    const totalAmount = targetSeats.reduce((sum, s) => sum + parseFloat(s.seat_price), 0);

    // 4. Generate unique readable booking reference
    const bookingRef = `SL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 5. Create Booking record
    const bookingRes = await client.query(`
      INSERT INTO bookings (booking_reference, show_id, user_id, total_amount, status)
      VALUES ($1, $2, $3, $4, 'CONFIRMED')
      RETURNING id, booking_reference, total_amount, created_at;
    `, [bookingRef, showId, userId, totalAmount]);

    const booking = bookingRes.rows[0];

    // 6. Transition show_seats to BOOKED
    await client.query(`
      UPDATE show_seats
      SET 
        status = 'BOOKED',
        held_until = NULL,
        version = version + 1,
        updated_at = NOW()
      WHERE show_id = $1 AND seat_id = ANY($2::int[]);
    `, [showId, seatIds]);

    // 7. Insert booking seat items
    for (const seat of targetSeats) {
      await client.query(`
        INSERT INTO booking_seats (booking_id, show_seat_id, price_paid)
        VALUES ($1, $2, $3);
      `, [booking.id, seat.show_seat_id, seat.seat_price]);
    }

    // 8. Record reservation with Pay-at-Theater status
    await client.query(`
      INSERT INTO payments (booking_id, amount, status, idempotency_key, payment_method)
      VALUES ($1, $2, 'PENDING_AT_COUNTER', $3, COALESCE($4, 'PAY_AT_THEATER'));
    `, [booking.id, totalAmount, idempotencyKey, paymentMethod]);

    // 9. Fetch show, movie, and theater info for ticket confirmation & SMS dispatch
    const showDetailsRes = await client.query(`
      SELECT 
        s.id AS show_id,
        s.start_time,
        m.title AS movie_title,
        sc.name AS screen_name,
        t.name AS theater_name
      FROM shows s
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      WHERE s.id = $1
    `, [showId]);

    const showInfo = showDetailsRes.rows[0];
    const movieTitle = showInfo?.movie_title || 'Movie';
    const theaterName = showInfo?.theater_name || 'Cinema';
    const screenName = showInfo?.screen_name || 'Screen';
    const seatLabels = targetSeats.map((s) => `Row ${s.row_label}-${s.seat_number}`).join(', ');

    const formattedShowTime = showInfo?.start_time
      ? new Date(showInfo.start_time).toLocaleString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    // Dispatch Cinema Reservation Confirmation Email
    sendBookingConfirmationEmail({
      to: recipientEmail,
      customerName: customerName || req.user.full_name || 'Valued Cinema Guest',
      bookingReference: bookingRef,
      movieTitle,
      theaterName,
      screenName,
      showTime: formattedShowTime,
      seats: targetSeats.map((s) => ({ label: `${s.row_label}${s.seat_number}` })),
      totalAmount,
    }).catch((err) => {
      console.error('[EMAIL-DISPATCH-ERROR]', err);
    });

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully! Confirmation email has been sent.',
      data: {
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        totalAmount,
        seats: targetSeats.map((s) => ({
          seatId: s.seat_id,
          label: `${s.row_label}${s.seat_number}`,
          price: s.seat_price,
        })),
        createdAt: booking.created_at,
        movieTitle,
        theaterName,
        screenName,
        customerName: customerName || req.user.full_name || 'Valued Customer',
        customerEmail: recipientEmail,
        customerPhone: cleanPhone,
        emailNotification: {
          sent: true,
          recipient: recipientEmail,
          dispatchedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get authenticated user's booking history
 */
export const getMyBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        b.id AS booking_id,
        b.booking_reference,
        b.total_amount,
        b.status,
        b.created_at,
        m.id AS movie_id,
        m.title AS movie_title,
        m.poster_url,
        m.duration_mins,
        s.start_time,
        s.end_time,
        sc.name AS screen_name,
        t.name AS theater_name,
        t.city AS theater_city,
        json_agg(json_build_object(
          'seat_id', st.id,
          'label', concat(st.row_label, st.seat_number),
          'tier', st.tier,
          'price', bs.price_paid
        )) AS seats
      FROM bookings b
      JOIN shows s ON b.show_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      JOIN booking_seats bs ON bs.booking_id = b.id
      JOIN show_seats ss ON bs.show_seat_id = ss.id
      JOIN seats st ON ss.seat_id = st.id
      WHERE b.user_id = $1 AND b.status != 'CANCELLED'
      GROUP BY b.id, m.id, m.title, m.poster_url, m.duration_mins, s.start_time, s.end_time, sc.name, t.name, t.city
      ORDER BY b.created_at DESC;
    `, [userId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a reservation and release seats immediately
 */
export const cancelBooking = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch booking with lock (supports both numeric ID and booking reference string)
    const bookingRes = await client.query(
      `SELECT * FROM bookings WHERE (id::text = $1 OR booking_reference = $1) FOR UPDATE`,
      [id ? id.toString() : '']
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];
    const actualBookingId = booking.id;

    // Authorization check
    if (booking.user_id !== userId && userRole !== 'ADMIN') {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Unauthorized to cancel this booking.' });
    }

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Booking is already cancelled.' });
    }

    // Check if show has already started or ended
    const showRes = await client.query('SELECT start_time FROM shows WHERE id = $1', [booking.show_id]);
    if (showRes.rows.length > 0 && new Date(showRes.rows[0].start_time) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel reservation for a show that has already started or ended.' 
      });
    }

    // 2. Mark booking as CANCELLED
    await client.query(
      `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`,
      [actualBookingId]
    );

    // 3. Find associated show seats and release them back to AVAILABLE
    const seatRes = await client.query(
      `SELECT show_seat_id FROM booking_seats WHERE booking_id = $1`,
      [actualBookingId]
    );

    const showSeatIds = seatRes.rows.map((r) => r.show_seat_id);
    if (showSeatIds.length > 0) {
      await client.query(
        `UPDATE show_seats 
         SET status = 'AVAILABLE', held_by_user_id = NULL, held_until = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1::int[])`,
        [showSeatIds]
      );
    }

    // 4. Update payment record to CANCELLED
    await client.query(
      `UPDATE payments SET status = 'CANCELLED' WHERE booking_id = $1`,
      [actualBookingId]
    );

    // 5. Fetch full booking details for cancellation email
    const bookingDetailsRes = await client.query(`
      SELECT 
        b.booking_reference,
        b.total_amount,
        u.email AS user_email,
        u.full_name AS user_name,
        m.title AS movie_title,
        t.name AS theater_name,
        sc.name AS screen_name,
        s.start_time,
        COALESCE(
          json_agg(concat(st.row_label, st.seat_number)) FILTER (WHERE st.id IS NOT NULL),
          '[]'
        ) AS seat_labels
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN shows s ON b.show_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      LEFT JOIN booking_seats bs ON bs.booking_id = b.id
      LEFT JOIN show_seats ss ON bs.show_seat_id = ss.id
      LEFT JOIN seats st ON ss.seat_id = st.id
      WHERE b.id = $1
      GROUP BY b.id, b.booking_reference, b.total_amount, u.email, u.full_name, m.title, t.name, sc.name, s.start_time
    `, [actualBookingId]);

    const bookingDetails = bookingDetailsRes.rows[0];

    // Dispatch Cancellation Email to user
    if (bookingDetails?.user_email) {
      const formattedShowTime = bookingDetails.start_time
        ? new Date(bookingDetails.start_time).toLocaleString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      sendBookingCancellationEmail({
        to: bookingDetails.user_email,
        customerName: bookingDetails.user_name || 'Valued Cinema Guest',
        bookingReference: bookingDetails.booking_reference,
        movieTitle: bookingDetails.movie_title || 'Movie',
        theaterName: bookingDetails.theater_name || 'Cinema',
        screenName: bookingDetails.screen_name || 'Screen',
        showTime: formattedShowTime,
        seats: bookingDetails.seat_labels || [],
        totalAmount: bookingDetails.total_amount,
      }).catch((err) => {
        console.error('[CANCELLATION-EMAIL-ERROR]', err);
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Reservation cancelled successfully. Confirmation email has been sent.',
      data: {
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        status: 'CANCELLED',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

