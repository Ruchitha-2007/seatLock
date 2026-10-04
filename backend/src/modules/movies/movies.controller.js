import { z } from 'zod';
import { query } from '../../config/db.js';

export const reviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(10),
    reviewText: z.string().min(3, 'Review must be at least 3 characters').max(1000),
  }),
});

// Get all movies with real-time aggregate rating, live review counts, and hype count
export const getAllMovies = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        m.id, 
        m.title, 
        m.description, 
        m.duration_mins, 
        m.genre, 
        m.poster_url, 
        m.release_date,
        m.actors,
        COALESCE(m.hype_count, 0)::int AS hype_count,
        COALESCE(rev.avg_rating, m.rating) AS rating,
        COALESCE(rev.reviews_count, 0)::int AS reviews_count,
        COALESCE(sh.active_shows_count, 0)::int AS active_shows_count
      FROM movies m
      LEFT JOIN (
        SELECT 
          movie_id, 
          COUNT(id)::int AS reviews_count,
          TO_CHAR(ROUND(AVG(rating), 1), 'FM999999999.0') AS avg_rating
        FROM reviews
        GROUP BY movie_id
      ) rev ON rev.movie_id = m.id
      LEFT JOIN (
        SELECT 
          movie_id, 
          COUNT(id)::int AS active_shows_count
        FROM shows
        WHERE start_time > NOW()
        GROUP BY movie_id
      ) sh ON sh.movie_id = m.id
      ORDER BY m.release_date DESC NULLS LAST, m.id DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

// Increment hype count for a movie
export const hypeMovie = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie ID' });
    }

    const result = await query(`
      UPDATE movies
      SET hype_count = COALESCE(hype_count, 0) + 1
      WHERE id = $1
      RETURNING id, title, hype_count
    `, [movieId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    res.json({
      success: true,
      message: `Hyped ${result.rows[0].title}!`,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get single movie with upcoming shows and live reviews
export const getMovieById = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie ID' });
    }

    const movieRes = await query(`
      SELECT 
        m.*,
        COALESCE(TO_CHAR(ROUND(AVG(r.rating), 1), 'FM999999999.0'), m.rating) AS avg_rating,
        COUNT(r.id)::int AS reviews_count
      FROM movies m
      LEFT JOIN reviews r ON r.movie_id = m.id
      WHERE m.id = $1
      GROUP BY m.id
    `, [movieId]);

    if (movieRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    const showsRes = await query(`
      SELECT 
        s.id AS show_id,
        s.start_time,
        s.end_time,
        s.base_price,
        sc.id AS screen_id,
        sc.name AS screen_name,
        t.id AS theater_id,
        t.name AS theater_name,
        t.city AS theater_city,
        t.address AS theater_address
      FROM shows s
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      WHERE s.movie_id = $1 AND s.start_time > NOW()
      ORDER BY s.start_time ASC
    `, [movieId]);

    // Fetch reviews with author id
    const reviewsRes = await query(`
      SELECT 
        r.id,
        r.user_id,
        r.rating,
        r.review_text,
        r.is_verified_buyer,
        r.created_at,
        u.full_name AS user_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.movie_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
    `, [movieId]);

    res.json({
      success: true,
      data: {
        movie: movieRes.rows[0],
        shows: showsRes.rows,
        reviews: reviewsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all reviews for a movie
export const getMovieReviews = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie ID' });
    }

    const reviewsRes = await query(`
      SELECT 
        r.id,
        r.user_id,
        r.rating,
        r.review_text,
        r.is_verified_buyer,
        r.created_at,
        u.full_name AS user_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.movie_id = $1
      ORDER BY r.created_at DESC
    `, [movieId]);

    // Calculate aggregated stats
    const statsRes = await query(`
      SELECT 
        COUNT(id)::int AS total_reviews,
        COALESCE(TO_CHAR(ROUND(AVG(rating), 1), 'FM999999999.0'), '0.0') AS avg_rating
      FROM reviews
      WHERE movie_id = $1
    `, [movieId]);

    // Determine user review eligibility
    let userReviewStatus = {
      canReview: false,
      reason: 'not_logged_in', // 'not_logged_in' | 'no_ticket' | 'show_upcoming' | 'eligible'
      hasCompletedShow: false,
      hasUpcomingShow: false,
      existingReview: null,
    };

    if (req.user) {
      // Find existing user review if any
      const userReview = reviewsRes.rows.find(r => r.user_id === req.user.id);

      // Check if user has completed watching this movie (confirmed booking with show start_time <= NOW())
      const completedBooking = await query(`
        SELECT b.id, s.start_time
        FROM bookings b
        JOIN shows s ON b.show_id = s.id
        WHERE b.user_id = $1 AND s.movie_id = $2 AND b.status = 'CONFIRMED' AND s.start_time <= NOW()
        ORDER BY s.start_time DESC
        LIMIT 1;
      `, [req.user.id, movieId]);

      if (completedBooking.rows.length > 0) {
        userReviewStatus = {
          canReview: true,
          reason: 'eligible',
          hasCompletedShow: true,
          hasUpcomingShow: false,
          existingReview: userReview || null,
        };
      } else {
        // Check if user has an upcoming booking
        const upcomingBooking = await query(`
          SELECT b.id, s.start_time
          FROM bookings b
          JOIN shows s ON b.show_id = s.id
          WHERE b.user_id = $1 AND s.movie_id = $2 AND b.status = 'CONFIRMED' AND s.start_time > NOW()
          ORDER BY s.start_time ASC
          LIMIT 1;
        `, [req.user.id, movieId]);

        if (upcomingBooking.rows.length > 0) {
          userReviewStatus = {
            canReview: false,
            reason: 'show_upcoming',
            hasCompletedShow: false,
            hasUpcomingShow: true,
            showTime: upcomingBooking.rows[0].start_time,
            existingReview: userReview || null,
          };
        } else {
          userReviewStatus = {
            canReview: false,
            reason: 'no_ticket',
            hasCompletedShow: false,
            hasUpcomingShow: false,
            existingReview: userReview || null,
          };
        }
      }
    }

    res.json({
      success: true,
      data: reviewsRes.rows,
      stats: statsRes.rows[0],
      userReviewStatus,
    });
  } catch (error) {
    next(error);
  }
};

// Create a review
export const createMovieReview = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { rating, reviewText } = req.validated.body;

    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie ID' });
    }

    // Check if user has a confirmed booking for a show that has already started/completed
    const completedBooking = await query(`
      SELECT b.id, s.start_time 
      FROM bookings b
      JOIN shows s ON b.show_id = s.id
      WHERE b.user_id = $1 AND s.movie_id = $2 AND b.status = 'CONFIRMED' AND s.start_time <= NOW()
      ORDER BY s.start_time DESC
      LIMIT 1;
    `, [userId, movieId]);

    if (completedBooking.rows.length === 0) {
      // Check if user has an upcoming show
      const upcomingBooking = await query(`
        SELECT b.id, s.start_time 
        FROM bookings b
        JOIN shows s ON b.show_id = s.id
        WHERE b.user_id = $1 AND s.movie_id = $2 AND b.status = 'CONFIRMED' AND s.start_time > NOW()
        ORDER BY s.start_time ASC
        LIMIT 1;
      `, [userId, movieId]);

      if (upcomingBooking.rows.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Your show has not concluded yet. Rating and reviews are unlocked only after you complete watching the movie.',
        });
      }

      return res.status(403).json({
        success: false,
        error: 'Only viewers who have booked and completed watching this movie can submit a rating and review.',
      });
    }

    const bookingId = completedBooking.rows[0].id;

    // Check if user has already reviewed this movie
    const existing = await query(`
      SELECT id FROM reviews WHERE user_id = $1 AND movie_id = $2 LIMIT 1;
    `, [userId, movieId]);

    let result;
    if (existing.rows.length > 0) {
      result = await query(`
        UPDATE reviews
        SET rating = $1, review_text = $2, booking_id = $3, is_verified_buyer = TRUE, created_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `, [rating, reviewText, bookingId, existing.rows[0].id]);
    } else {
      result = await query(`
        INSERT INTO reviews (movie_id, user_id, booking_id, rating, review_text, is_verified_buyer)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING *;
      `, [movieId, userId, bookingId, rating, reviewText]);
    }

    // Compute new aggregate rating and review count
    const statsRes = await query(`
      SELECT 
        COUNT(id)::int AS reviews_count,
        ROUND(AVG(rating), 1) AS avg_rating
      FROM reviews
      WHERE movie_id = $1
    `, [movieId]);

    res.status(201).json({
      success: true,
      message: 'Thank you! Your verified movie rating & review has been published.',
      data: result.rows[0],
      stats: statsRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Delete a review
export const deleteMovieReview = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.movieId, 10);
    const reviewId = parseInt(req.params.reviewId, 10);
    const userId = req.user.id;
    const userRole = req.user.role;

    if (isNaN(movieId) || isNaN(reviewId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie or review ID' });
    }

    // Check if review exists and belongs to user
    const checkRes = await query(
      'SELECT id, user_id FROM reviews WHERE id = $1 AND movie_id = $2',
      [reviewId, movieId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const review = checkRes.rows[0];
    if (review.user_id !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'You are not authorized to delete this review' });
    }

    await query('DELETE FROM reviews WHERE id = $1', [reviewId]);

    // Compute updated stats
    const statsRes = await query(`
      SELECT 
        COUNT(id)::int AS reviews_count,
        COALESCE(ROUND(AVG(rating), 1)::text, '0.0') AS avg_rating
      FROM reviews
      WHERE movie_id = $1
    `, [movieId]);

    res.json({
      success: true,
      message: 'Review deleted successfully',
      stats: statsRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get seat map for a specific show with real-time status resolution
export const getShowSeatMap = async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id, 10);
    const currentUserId = req.user?.id || null;

    if (isNaN(showId)) {
      return res.status(400).json({ success: false, error: 'Invalid show ID' });
    }

    // Verify show existence
    const showRes = await query(`
      SELECT 
        s.id AS show_id, 
        s.start_time, 
        s.base_price,
        m.title AS movie_title,
        sc.name AS screen_name,
        t.name AS theater_name
      FROM shows s
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      WHERE s.id = $1
    `, [showId]);

    if (showRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Show not found' });
    }

    // Fetch all seats for this show, dynamically evaluating expired holds
    const seatsRes = await query(`
      SELECT 
        ss.id AS show_seat_id,
        s.id AS seat_id,
        s.row_label,
        s.seat_number,
        s.tier,
        s.price_multiplier,
        ROUND(sh.base_price * s.price_multiplier, 2) AS price,
        CASE 
          WHEN ss.status = 'BOOKED' THEN 'BOOKED'
          WHEN ss.status = 'HELD' AND ss.held_until > NOW() THEN 'HELD'
          ELSE 'AVAILABLE'
        END AS effective_status,
        CASE 
          WHEN ss.status = 'HELD' AND ss.held_until > NOW() AND ss.held_by_user_id = $2 THEN true
          ELSE false
        END AS is_my_hold,
        CASE 
          WHEN ss.status = 'HELD' AND ss.held_until > NOW() THEN ss.held_until
          ELSE NULL
        END AS held_until
      FROM show_seats ss
      JOIN seats s ON ss.seat_id = s.id
      JOIN shows sh ON ss.show_id = sh.id
      WHERE ss.show_id = $1
      ORDER BY s.row_label ASC, s.seat_number ASC
    `, [showId, currentUserId]);

    res.json({
      success: true,
      data: {
        show: showRes.rows[0],
        seats: seatsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};
