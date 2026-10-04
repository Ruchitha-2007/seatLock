import { query } from '../../config/db.js';
import { sendBookingCancellationEmail } from '../../services/emailService.js';
import { sendRealSms } from '../../services/smsService.js';

// 1. Get comprehensive operations metrics
export const getAdminDashboardStats = async (req, res, next) => {
  try {
    const moviesCountRes = await query(`SELECT COUNT(*)::int AS total_movies FROM movies;`);
    const showsCountRes = await query(`SELECT COUNT(*)::int AS total_upcoming_shows FROM shows WHERE start_time > NOW();`);
    const bookingsRes = await query(`
      SELECT 
        COUNT(*)::int AS total_bookings,
        COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END)::int AS confirmed_bookings,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled_bookings,
        COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN total_amount ELSE 0 END), 0)::numeric AS total_revenue
      FROM bookings;
    `);

    const demandsRes = await query(`
      SELECT 
        COUNT(*)::int AS total_requests,
        COUNT(CASE WHEN status = 'VOTING' THEN 1 END)::int AS voting_requests,
        COUNT(CASE WHEN status = 'GREENLIT' THEN 1 END)::int AS greenlit_requests,
        COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END)::int AS scheduled_requests
      FROM movie_requests;
    `);

    const recentBookingsRes = await query(`
      SELECT 
        b.id AS booking_id,
        b.booking_reference,
        b.total_amount,
        b.status,
        b.created_at,
        u.full_name AS customer_name,
        u.email AS customer_email,
        m.title AS movie_title,
        s.start_time,
        t.name AS theater_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN shows s ON b.show_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      ORDER BY b.created_at DESC
      LIMIT 10;
    `);

    res.json({
      success: true,
      stats: {
        totalMovies: moviesCountRes.rows[0].total_movies,
        totalUpcomingShows: showsCountRes.rows[0].total_upcoming_shows,
        totalBookings: bookingsRes.rows[0].total_bookings,
        confirmedBookings: bookingsRes.rows[0].confirmed_bookings,
        totalRevenue: parseFloat(bookingsRes.rows[0].total_revenue).toFixed(2),
        audienceRequests: demandsRes.rows[0],
      },
      recentBookings: recentBookingsRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Directly add a new movie to catalog with duplicate prevention
export const createMovie = async (req, res, next) => {
  try {
    const {
      title,
      description,
      genre,
      durationMinutes,
      duration_mins,
      rating,
      posterUrl,
      releaseDate,
      actors,
      hypeCount = 100
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Movie title is required' });
    }

    const trimmedTitle = title.trim();

    // Prevent duplicate movie additions
    const existing = await query(`
      SELECT id, title FROM movies WHERE LOWER(TRIM(title)) = LOWER($1) LIMIT 1;
    `, [trimmedTitle]);

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Movie "${existing.rows[0].title}" already exists in the catalog (ID: ${existing.rows[0].id}). Duplicate movies cannot be added.`,
      });
    }

    const safePoster = posterUrl && posterUrl.trim()
      ? posterUrl.trim()
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop';

    const mins = parseInt(durationMinutes || duration_mins || 150, 10);
    const safeRating = rating ? String(parseFloat(rating).toFixed(1)) : '9.0';

    const result = await query(`
      INSERT INTO movies (
        title, 
        description, 
        genre, 
        duration_mins, 
        rating, 
        poster_url, 
        release_date, 
        actors, 
        hype_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `, [
      trimmedTitle,
      description || 'Telugu Theatrical Release on SeatLock.',
      genre || 'Telugu Action Drama',
      mins,
      safeRating,
      safePoster,
      releaseDate || new Date().toISOString().split('T')[0],
      actors || 'Leading Telugu Stars',
      hypeCount ? parseInt(hypeCount, 10) : 150
    ]);

    res.status(201).json({
      success: true,
      message: `Movie "${result.rows[0].title}" added to SeatLock catalog successfully!`,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A movie with this title already exists in the catalog. Duplicate movies are not allowed.',
      });
    }
    next(error);
  }
};

// 2b. Update / Edit an existing movie in the catalog
export const updateMovie = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie ID' });
    }

    const movieRes = await query(`SELECT * FROM movies WHERE id = $1;`, [movieId]);
    if (movieRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    const current = movieRes.rows[0];
    const {
      title,
      description,
      genre,
      durationMinutes,
      duration_mins,
      rating,
      posterUrl,
      releaseDate,
      actors,
      hypeCount
    } = req.body;

    const newTitle = title ? title.trim() : current.title;

    // If title is changing, check for duplicate title
    if (newTitle.toLowerCase() !== current.title.toLowerCase()) {
      const dup = await query(`
        SELECT id, title FROM movies WHERE LOWER(TRIM(title)) = LOWER($1) AND id != $2 LIMIT 1;
      `, [newTitle, movieId]);

      if (dup.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Another movie with the title "${dup.rows[0].title}" already exists in the catalog (ID: ${dup.rows[0].id}). Duplicate titles are not allowed.`
        });
      }
    }

    const newDuration = (durationMinutes || duration_mins) ? parseInt(durationMinutes || duration_mins, 10) : current.duration_mins;
    const newRating = rating !== undefined ? String(parseFloat(rating).toFixed(1)) : current.rating;
    const newPoster = (posterUrl !== undefined && posterUrl.trim()) ? posterUrl.trim() : current.poster_url;
    const newDesc = description !== undefined ? description : current.description;
    const newGenre = genre !== undefined ? genre : current.genre;
    const newReleaseDate = releaseDate || current.release_date;
    const newActors = actors !== undefined ? actors : current.actors;
    const newHype = hypeCount !== undefined ? parseInt(hypeCount, 10) : current.hype_count;

    const result = await query(`
      UPDATE movies 
      SET 
        title = $1,
        description = $2,
        genre = $3,
        duration_mins = $4,
        rating = $5,
        poster_url = $6,
        release_date = $7,
        actors = $8,
        hype_count = $9
      WHERE id = $10
      RETURNING *;
    `, [
      newTitle,
      newDesc,
      newGenre,
      newDuration,
      newRating,
      newPoster,
      newReleaseDate,
      newActors,
      newHype,
      movieId
    ]);

    res.json({
      success: true,
      message: `Movie "${result.rows[0].title}" has been updated successfully!`,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A movie with this title already exists in the catalog.',
      });
    }
    next(error);
  }
};

// 2b. Delete a movie (cascade clean up shows, reviews, bookings, and notify customers)
export const deleteMovie = async (req, res, next) => {
  try {
    const movieId = parseInt(req.params.id, 10);
    const force = req.query.force === 'true';

    if (isNaN(movieId)) {
      return res.status(400).json({ success: false, error: 'Invalid movie ID' });
    }

    const movieRes = await query(`SELECT id, title FROM movies WHERE id = $1;`, [movieId]);
    if (movieRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    const movieTitle = movieRes.rows[0].title;

    // Fetch all upcoming confirmed bookings on this movie across any of its shows with customer details & seat labels
    const activeBookingsRes = await query(`
      SELECT 
        b.id AS booking_id,
        b.booking_reference,
        b.total_amount,
        u.email AS customer_email,
        u.full_name AS customer_name,
        s.id AS show_id,
        s.start_time,
        t.name AS theater_name,
        sc.name AS screen_name,
        COALESCE(
          json_agg(concat(st.row_label, st.seat_number)) FILTER (WHERE st.id IS NOT NULL),
          '[]'
        ) AS seat_labels
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN shows s ON b.show_id = s.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      LEFT JOIN booking_seats bs ON bs.booking_id = b.id
      LEFT JOIN show_seats ss ON bs.show_seat_id = ss.id
      LEFT JOIN seats st ON ss.seat_id = st.id
      WHERE s.movie_id = $1 AND b.status = 'CONFIRMED' AND s.start_time > NOW()
      GROUP BY b.id, b.booking_reference, b.total_amount, u.email, u.full_name, s.id, s.start_time, t.name, sc.name;
    `, [movieId]);

    const affectedBookings = activeBookingsRes.rows;
    const activeCount = affectedBookings.length;

    if (activeCount > 0 && !force) {
      return res.status(400).json({
        success: false,
        hasActiveBookings: true,
        activeBookingsCount: activeCount,
        error: `Cannot delete "${movieTitle}": There are ${activeCount} confirmed customer booking(s) scheduled for this movie. Confirm deletion to cancel all upcoming shows, revoke customer reservations, and email cancellation notices to all ticket holders.`
      });
    }

    // Cascade delete inside database transaction
    await query('BEGIN;');

    // 1. Delete booking seats for this movie's shows
    await query(`
      DELETE FROM booking_seats 
      WHERE booking_id IN (
        SELECT b.id FROM bookings b JOIN shows s ON b.show_id = s.id WHERE s.movie_id = $1
      );
    `, [movieId]);

    // 2. Delete payments for this movie's bookings
    await query(`
      DELETE FROM payments 
      WHERE booking_id IN (
        SELECT b.id FROM bookings b JOIN shows s ON b.show_id = s.id WHERE s.movie_id = $1
      );
    `, [movieId]);

    // 3. Delete bookings
    await query(`
      DELETE FROM bookings 
      WHERE show_id IN (SELECT id FROM shows WHERE movie_id = $1);
    `, [movieId]);

    // 4. Delete show seats inventory
    await query(`
      DELETE FROM show_seats 
      WHERE show_id IN (SELECT id FROM shows WHERE movie_id = $1);
    `, [movieId]);

    // 5. Delete shows
    await query(`DELETE FROM shows WHERE movie_id = $1;`, [movieId]);

    // 6. Delete reviews
    await query(`DELETE FROM reviews WHERE movie_id = $1;`, [movieId]);

    // 7. Unlink from audience demands
    await query(`UPDATE movie_requests SET greenlit_movie_id = NULL WHERE greenlit_movie_id = $1;`, [movieId]);

    // 8. Delete the movie
    await query(`DELETE FROM movies WHERE id = $1;`, [movieId]);

    await query('COMMIT;');

    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formatDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    // Dispatch Cancellation Emails to all affected customers in background
    if (affectedBookings.length > 0) {
      console.log(`[ADMIN-MOVIE-DELETE] 📧 Dispatching cancellation notices to ${affectedBookings.length} customer(s) for "${movieTitle}"...`);

      affectedBookings.forEach((ab) => {
        const formattedShowTime = `${formatDate(ab.start_time)} at ${formatTime(ab.start_time)}`;
        if (ab.customer_email) {
          sendBookingCancellationEmail({
            to: ab.customer_email,
            customerName: ab.customer_name || 'Valued Cinema Guest',
            bookingReference: ab.booking_reference,
            movieTitle: movieTitle,
            theaterName: ab.theater_name,
            screenName: ab.screen_name,
            showTime: formattedShowTime,
            seats: ab.seat_labels || [],
            totalAmount: ab.total_amount,
          }).catch((err) => {
            console.error(`[ADMIN-MOVIE-DELETE-EMAIL-ERROR] Failed to email ${ab.customer_email}:`, err.message);
          });
        }
      });
    }

    res.json({
      success: true,
      message: `Movie "${movieTitle}" and all its scheduled shows have been deleted from the catalog.${affectedBookings.length > 0 ? ` Cancellation emails dispatched to ${affectedBookings.length} ticket holder(s).` : ''}`,
      notifiedCustomersCount: affectedBookings.length,
    });
  } catch (error) {
    await query('ROLLBACK;').catch(() => {});
    next(error);
  }
};

// 2c. Register a new theater multiplex with duplicate check
export const createTheater = async (req, res, next) => {
  try {
    const { name, city, address, totalScreens = 3 } = req.body;
    if (!name || !name.trim() || !city || !city.trim() || !address) {
      return res.status(400).json({ success: false, error: 'Theater name, city, and address are required' });
    }

    const trimmedName = name.trim();
    const trimmedCity = city.trim();

    // Prevent duplicate theaters in the same city
    const existing = await query(`
      SELECT id, name FROM theaters 
      WHERE LOWER(TRIM(name)) = LOWER($1) AND LOWER(TRIM(city)) = LOWER($2) 
      LIMIT 1;
    `, [trimmedName, trimmedCity]);

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Theater "${existing.rows[0].name}" in "${trimmedCity}" is already registered (ID: ${existing.rows[0].id}). Duplicate theaters are not allowed.`
      });
    }

    const theaterRes = await query(`
      INSERT INTO theaters (name, city, address, total_screens)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [trimmedName, trimmedCity, address.trim(), totalScreens]);

    const newTheater = theaterRes.rows[0];

    // Auto-create screens and default seat maps
    const screenCount = Math.max(1, Math.min(totalScreens, 6));
    for (let i = 1; i <= screenCount; i++) {
      const screenName = i === 1 ? 'Screen 1 (Dolby Atmos 4K)' : i === 2 ? 'Screen 2 (IMAX Dual Laser)' : `Screen ${i} (Dolby 7.1)`;
      const screenRes = await query(`
        INSERT INTO screens (theater_id, name, total_seats)
        VALUES ($1, $2, 60)
        RETURNING id;
      `, [newTheater.id, screenName]);

      const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
      for (const r of rows) {
        const tier = (r === 'A' || r === 'B') ? 'VIP_RECLINER' : (r === 'C' || r === 'D') ? 'PREMIUM' : 'EXECUTIVE';
        const mult = tier === 'VIP_RECLINER' ? 1.5 : tier === 'PREMIUM' ? 1.2 : 1.0;
        for (let n = 1; n <= 10; n++) {
          await query(`
            INSERT INTO seats (screen_id, row_label, seat_number, tier, price_multiplier)
            VALUES ($1, $2, $3, $4, $5);
          `, [screenRes.rows[0].id, r, n, tier, mult]);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Theater "${newTheater.name}" with ${screenCount} auditoriums registered successfully!`,
      theater: newTheater,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A theater with this name in this city is already registered.',
      });
    }
    next(error);
  }
};

// 2d. Add a new screen / auditorium to an existing theater
export const createScreen = async (req, res, next) => {
  try {
    const theaterId = parseInt(req.params.theaterId, 10);
    const { name, totalSeats = 60 } = req.body;

    if (!theaterId || isNaN(theaterId)) {
      return res.status(400).json({ success: false, error: 'Valid theater ID is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Screen name is required (e.g. Screen 5 - Dolby Atmos)' });
    }

    const trimmedName = name.trim();
    const screenRes = await query(`
      INSERT INTO screens (theater_id, name, total_seats)
      VALUES ($1, $2, $3)
      RETURNING *;
    `, [theaterId, trimmedName, parseInt(totalSeats, 10) || 60]);

    const newScreen = screenRes.rows[0];

    // Seed 60 standard seats (Silver, Gold, Recliner)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const r of rows) {
      const tier = (r === 'A' || r === 'B') ? 'SILVER' : (r === 'C' || r === 'D') ? 'GOLD' : 'RECLINER';
      const mult = tier === 'SILVER' ? 1.0 : tier === 'GOLD' ? 1.35 : 1.8;
      for (let n = 1; n <= 10; n++) {
        await query(`
          INSERT INTO seats (screen_id, row_label, seat_number, tier, price_multiplier)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (screen_id, row_label, seat_number) DO NOTHING;
        `, [newScreen.id, r, n, tier, mult]);
      }
    }

    res.status(201).json({
      success: true,
      message: `Auditorium "${newScreen.name}" added to theater with 60 seats configured!`,
      data: newScreen,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get all theaters and screens for scheduling dropdowns
export const getTheatersAndScreens = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        t.id AS theater_id,
        t.name AS theater_name,
        t.city AS theater_city,
        s.id AS screen_id,
        s.name AS screen_name,
        s.total_seats
      FROM theaters t
      JOIN screens s ON s.theater_id = t.id
      ORDER BY t.city, t.name, s.name;
    `);

    // Group screens under theaters
    const theaterMap = {};
    result.rows.forEach(r => {
      if (!theaterMap[r.theater_id]) {
        theaterMap[r.theater_id] = {
          id: r.theater_id,
          name: r.theater_name,
          city: r.theater_city,
          screens: [],
        };
      }
      theaterMap[r.theater_id].screens.push({
        id: r.screen_id,
        name: r.screen_name,
        totalSeats: r.total_seats,
      });
    });

    res.json({
      success: true,
      theaters: Object.values(theaterMap),
    });
  } catch (error) {
    next(error);
  }
};

// 4. Schedule a show for a movie & generate seat inventory with strict collision prevention
export const scheduleShow = async (req, res, next) => {
  try {
    const { movieId, screenId, startTime, basePrice = 200, requestId } = req.body;

    if (!movieId || !screenId || !startTime) {
      return res.status(400).json({ success: false, error: 'Movie, screen, and show start time are required' });
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid start time format' });
    }

    // Past time validation (allow 5 min clock skew buffer)
    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        error: 'Cannot schedule a show in the past. Please select an upcoming date and time.',
      });
    }

    // 1. Fetch movie details (duration_mins, title)
    const movieRes = await query(`
      SELECT id, title, duration_mins 
      FROM movies 
      WHERE id = $1;
    `, [movieId]);

    if (movieRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie not found in catalog' });
    }

    const movie = movieRes.rows[0];
    const durationMins = parseInt(movie.duration_mins, 10) || 150;
    const cleaningBufferMins = 15; // 15 mins turnaround/sanitization buffer between shows
    const totalRuntimeWithBuffer = durationMins + cleaningBufferMins;
    const end = new Date(start.getTime() + totalRuntimeWithBuffer * 60 * 1000);

    // 2. Fetch screen and theater details
    const screenRes = await query(`
      SELECT s.id, s.name AS screen_name, s.total_seats, t.id AS theater_id, t.name AS theater_name, t.city
      FROM screens s
      JOIN theaters t ON s.theater_id = t.id
      WHERE s.id = $1;
    `, [screenId]);

    if (screenRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Auditorium screen not found' });
    }

    const screenInfo = screenRes.rows[0];

    // Helper functions for readable dates and times
    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formatDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    // 3. CHECK COLLISION A: Same Screen / Auditorium Time Collision
    // Two intervals [start, end) and [s.start_time, s.end_time) overlap if s.start_time < end AND s.end_time > start
    const screenCollision = await query(`
      SELECT 
        s.id AS show_id,
        s.start_time,
        s.end_time,
        m.title AS movie_title,
        m.duration_mins
      FROM shows s
      JOIN movies m ON s.movie_id = m.id
      WHERE s.screen_id = $1
        AND s.start_time < $2
        AND s.end_time > $3
      ORDER BY s.start_time ASC
      LIMIT 1;
    `, [screenId, end, start]);

    if (screenCollision.rows.length > 0) {
      const col = screenCollision.rows[0];
      const colDate = formatDate(col.start_time);
      const colStart = formatTime(col.start_time);
      const colEnd = formatTime(col.end_time);
      const reqStart = formatTime(start);
      const reqEnd = formatTime(end);

      return res.status(409).json({
        success: false,
        collisionType: 'SCREEN_OCCUPIED',
        error: `Schedule Collision: "${screenInfo.screen_name}" at ${screenInfo.theater_name} is already occupied on ${colDate} by "${col.movie_title}" (${colStart} – ${colEnd}). Your requested slot (${reqStart} – ${reqEnd}) overlaps with this show. Please select a start time after ${colEnd} or pick another screen.`,
        details: {
          screen: screenInfo.screen_name,
          theater: screenInfo.theater_name,
          occupyingMovie: col.movie_title,
          occupiedFrom: col.start_time,
          occupiedTo: col.end_time,
          suggestedNextStart: col.end_time,
        }
      });
    }

    // 4. CHECK COLLISION B: Duplicate Show for Same Movie in Same Theater at Same Time
    // Prevent scheduling the exact same film within 30 minutes in the same multiplex across any screens
    const theaterMovieCollision = await query(`
      SELECT 
        s.id AS show_id,
        s.start_time,
        s.end_time,
        sc.name AS screen_name
      FROM shows s
      JOIN screens sc ON s.screen_id = sc.id
      WHERE s.movie_id = $1
        AND sc.theater_id = $2
        AND ABS(EXTRACT(EPOCH FROM (s.start_time - $3))) < 1800 -- within 30 mins
      LIMIT 1;
    `, [movieId, screenInfo.theater_id, start]);

    if (theaterMovieCollision.rows.length > 0) {
      const col = theaterMovieCollision.rows[0];
      const colTime = formatTime(col.start_time);
      const colDate = formatDate(col.start_time);
      return res.status(409).json({
        success: false,
        collisionType: 'DUPLICATE_THEATER_SHOW',
        error: `Duplicate Show Warning: "${movie.title}" is already scheduled at ${screenInfo.theater_name} on ${colDate} at ${colTime} in ${col.screen_name}. Simultaneous shows for the exact same movie in the same theater are restricted to prevent duplicate scheduling.`,
        details: {
          movie: movie.title,
          theater: screenInfo.theater_name,
          existingScreen: col.screen_name,
          existingStartTime: col.start_time
        }
      });
    }

    // 5. Insert show safely
    const showRes = await query(`
      INSERT INTO shows (movie_id, screen_id, start_time, end_time, base_price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [movieId, screenId, start, end, basePrice]);

    const createdShow = showRes.rows[0];

    // Populate show seats inventory for this screen
    await query(`
      INSERT INTO show_seats (show_id, seat_id, status)
      SELECT $1, st.id, 'AVAILABLE'
      FROM seats st
      WHERE st.screen_id = $2
      ON CONFLICT (show_id, seat_id) DO NOTHING;
    `, [createdShow.id, screenId]);

    // If linked to an audience demand, update status to SCHEDULED
    if (requestId) {
      await query(`
        UPDATE movie_requests 
        SET status = 'SCHEDULED', greenlit_movie_id = $1, admin_notes = 'Show successfully scheduled at partner theater!', updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [movieId, requestId]);
    }

    res.status(201).json({
      success: true,
      message: `Show for "${movie.title}" successfully scheduled at ${screenInfo.theater_name} (${screenInfo.screen_name}) from ${formatTime(start)} to ${formatTime(end)}! Seats are now live for booking.`,
      show: createdShow,
    });
  } catch (error) {
    next(error);
  }
};

// 4b. Get scheduled shows list for management
export const getAdminShows = async (req, res, next) => {
  try {
    const { movieId, theaterId } = req.query;
    let queryText = `
      SELECT 
        s.id,
        s.movie_id,
        m.title AS movie_title,
        m.poster_url,
        m.genre,
        m.duration_mins,
        s.screen_id,
        sc.name AS screen_name,
        sc.total_seats,
        t.id AS theater_id,
        t.name AS theater_name,
        t.city AS theater_city,
        s.start_time,
        s.end_time,
        s.base_price,
        COALESCE(b.booked_count, 0)::int AS booked_seats_count
      FROM shows s
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      LEFT JOIN (
        SELECT show_id, COUNT(id)::int AS booked_count
        FROM show_seats
        WHERE status = 'BOOKED'
        GROUP BY show_id
      ) b ON b.show_id = s.id
      WHERE s.start_time > NOW() - INTERVAL '2 hours'
    `;
    const params = [];
    let pIdx = 1;

    if (movieId) {
      queryText += ` AND s.movie_id = $${pIdx}`;
      params.push(movieId);
      pIdx++;
    }

    if (theaterId) {
      queryText += ` AND t.id = $${pIdx}`;
      params.push(theaterId);
      pIdx++;
    }

    queryText += ` ORDER BY s.start_time ASC LIMIT 100;`;

    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// 4c. Cancel / Delete a scheduled show
export const cancelShow = async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id, 10);
    const force = req.query.force === 'true';

    if (isNaN(showId)) {
      return res.status(400).json({ success: false, error: 'Invalid show ID' });
    }

    // Check if show exists
    const showRes = await query(`
      SELECT 
        s.id, 
        s.start_time, 
        m.title AS movie_title, 
        t.name AS theater_name, 
        sc.name AS screen_name
      FROM shows s
      JOIN movies m ON s.movie_id = m.id
      JOIN screens sc ON s.screen_id = sc.id
      JOIN theaters t ON sc.theater_id = t.id
      WHERE s.id = $1;
    `, [showId]);

    if (showRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scheduled show not found' });
    }

    const show = showRes.rows[0];

    // Check if there are confirmed customer bookings and retrieve their contact details
    const activeBookingsRes = await query(`
      SELECT 
        b.id AS booking_id,
        b.booking_reference,
        b.total_amount,
        u.email AS customer_email,
        u.full_name AS customer_name,
        COALESCE(
          json_agg(concat(st.row_label, st.seat_number)) FILTER (WHERE st.id IS NOT NULL),
          '[]'
        ) AS seat_labels
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN booking_seats bs ON bs.booking_id = b.id
      LEFT JOIN show_seats ss ON bs.show_seat_id = ss.id
      LEFT JOIN seats st ON ss.seat_id = st.id
      WHERE b.show_id = $1 AND b.status = 'CONFIRMED'
      GROUP BY b.id, b.booking_reference, b.total_amount, u.email, u.full_name;
    `, [showId]);

    const affectedBookings = activeBookingsRes.rows;
    const activeCount = affectedBookings.length;

    if (activeCount > 0 && !force) {
      return res.status(400).json({
        success: false,
        hasActiveBookings: true,
        activeBookingsCount: activeCount,
        error: `Cannot cancel show for "${show.movie_title}": There are ${activeCount} confirmed customer booking(s) for this show. Confirm cancellation to cancel the show, revoke reservations, and email all affected customers.`
      });
    }

    // Cascade delete in transaction
    await query('BEGIN;');
    await query(`
      DELETE FROM booking_seats 
      WHERE booking_id IN (SELECT id FROM bookings WHERE show_id = $1);
    `, [showId]);

    await query(`
      DELETE FROM payments 
      WHERE booking_id IN (SELECT id FROM bookings WHERE show_id = $1);
    `, [showId]);

    await query(`
      DELETE FROM bookings 
      WHERE show_id = $1;
    `, [showId]);

    await query(`
      DELETE FROM show_seats 
      WHERE show_id = $1;
    `, [showId]);

    await query(`
      DELETE FROM shows 
      WHERE id = $1;
    `, [showId]);
    await query('COMMIT;');

    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formatDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const formattedShowTime = `${formatDate(show.start_time)} at ${formatTime(show.start_time)}`;

    // Dispatch Cancellation Emails & SMS to all affected customers in background
    if (affectedBookings.length > 0) {
      console.log(`[ADMIN-SHOW-CANCEL] 📧 Dispatching cancellation notices to ${affectedBookings.length} customer(s)...`);
      
      affectedBookings.forEach((ab) => {
        if (ab.customer_email) {
          sendBookingCancellationEmail({
            to: ab.customer_email,
            customerName: ab.customer_name || 'Valued Cinema Guest',
            bookingReference: ab.booking_reference,
            movieTitle: show.movie_title,
            theaterName: show.theater_name,
            screenName: show.screen_name,
            showTime: formattedShowTime,
            seats: ab.seat_labels || [],
            totalAmount: ab.total_amount,
          }).catch((err) => {
            console.error(`[ADMIN-SHOW-CANCEL-EMAIL-ERROR] Failed to email ${ab.customer_email}:`, err.message);
          });
        }

        if (ab.customer_phone) {
          sendRealSms({
            phone: ab.customer_phone,
            message: `SeatLock Notice: Your screening of "${show.movie_title}" on ${formattedShowTime} at ${show.theater_name} has been cancelled by theater management. Your booking (${ab.booking_reference}) is voided.`
          }).catch((err) => {
            console.error(`[ADMIN-SHOW-CANCEL-SMS-ERROR] Failed to SMS ${ab.customer_phone}:`, err.message);
          });
        }
      });
    }

    res.json({
      success: true,
      message: `Show for "${show.movie_title}" (${formattedShowTime}) has been canceled.${affectedBookings.length > 0 ? ` Cancellation emails dispatched to ${affectedBookings.length} affected customer(s).` : ''}`,
      canceledShowId: showId,
      notifiedCustomersCount: affectedBookings.length,
    });
  } catch (error) {
    await query('ROLLBACK;');
    next(error);
  }
};

// 5. Greenlight / Approve an audience demand
export const greenlightDemand = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { adminNotes, createAsMovie } = req.body;

    const demandRes = await query(`SELECT * FROM movie_requests WHERE id = $1;`, [requestId]);
    if (demandRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const demand = demandRes.rows[0];
    let createdMovieId = demand.greenlit_movie_id;

    // Optional: directly promote demand into movies catalog if requested
    if (createAsMovie && !createdMovieId) {
      const cleanTitle = demand.title.replace(/\s*\([^)]*\)/g, '').trim();
      const existing = await query(`
        SELECT id FROM movies 
        WHERE LOWER(TRIM(title)) = LOWER($1) OR LOWER(TRIM(title)) = LOWER($2)
        ORDER BY id ASC
        LIMIT 1;
      `, [demand.title.trim(), cleanTitle]);

      if (existing.rows.length > 0) {
        createdMovieId = existing.rows[0].id;
      } else {
        const movieRes = await query(`
          INSERT INTO movies (title, description, genre, duration_mins, rating, poster_url, release_date, hype_count)
          VALUES ($1, $2, $3, 150, '9.2', $4, $5, 500)
          RETURNING id;
        `, [
          demand.title,
          demand.description,
          demand.genre || 'Audience Demand Re-release',
          demand.poster_url,
          `${demand.release_year || new Date().getFullYear()}-01-01`
        ]);
        createdMovieId = movieRes.rows[0].id;
      }
    }

    await query(`
      UPDATE movie_requests 
      SET status = 'GREENLIT', greenlit_movie_id = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [createdMovieId, adminNotes || 'Approved by Theater Management! Preparing special fan screening.', requestId]);

    res.json({
      success: true,
      message: 'Movie request GREENLIT by admin! Shows can now be allocated.',
      greenlitMovieId: createdMovieId,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Reject an audience demand
export const rejectDemand = async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { adminNotes } = req.body;

    await query(`
      UPDATE movie_requests 
      SET status = 'REJECTED', admin_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [adminNotes || 'Theatrical distribution prints unavailable for this title.', requestId]);

    res.json({
      success: true,
      message: 'Movie request status updated to REJECTED.',
    });
  } catch (error) {
    next(error);
  }
};
