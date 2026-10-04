import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

export const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    const catalogPath = path.resolve('src/db/verified_100_telugu_movies.json');
    if (!fs.existsSync(catalogPath)) {
      throw new Error(`Catalog not found at ${catalogPath}. Run download script first.`);
    }
    const teluguMovies = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

    console.log(`🌱 Refreshing database with ${teluguMovies.length} Telugu Blockbusters across Andhra Pradesh & Telangana multiplexes...`);
    await client.query('BEGIN');

    // Clean old data in FK order
    await client.query('DELETE FROM reviews');
    await client.query('DELETE FROM booking_seats');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM bookings');
    await client.query('DELETE FROM show_seats');
    await client.query('DELETE FROM shows');
    await client.query('DELETE FROM seats');
    await client.query('DELETE FROM screens');
    await client.query('DELETE FROM theaters');
    await client.query('DELETE FROM movies');

    // 1. Seed Users (with hashed passwords)
    const salt = await bcrypt.genSalt(10);
    const customerPasswordHash = await bcrypt.hash('Password123!', salt);
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', salt);

    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES 
        ('customer@example.com', $1, 'Karthik Varma', 'CUSTOMER'),
        ('admin@seatlock.com', $2, 'Cinema Operations Manager', 'ADMIN'),
        ('sneha.reddy@example.com', $1, 'Sneha Reddy', 'CUSTOMER'),
        ('ramesh.babu@example.com', $1, 'Ramesh Babu', 'CUSTOMER'),
        ('ananya.rao@example.com', $1, 'Ananya Rao', 'CUSTOMER'),
        ('vijay.kumar@example.com', $1, 'Vijay Kumar', 'CUSTOMER'),
        ('suresh.naidu@example.com', $1, 'Suresh Naidu', 'CUSTOMER'),
        ('deepika.p@example.com', $1, 'Deepika Pasupuleti', 'CUSTOMER')
      ON CONFLICT (email) DO NOTHING;
    `, [customerPasswordHash, adminPasswordHash]);

    const { rows: users } = await client.query('SELECT id, email, full_name FROM users');
    const userMap = {};
    users.forEach((u) => { userMap[u.email] = u.id; });

    // 2. Seed Renowned Multiplex Theaters across Andhra Pradesh & Telangana
    console.log('Seeding multiplex theaters across AP & Telangana...');
    const theatersData = [
      { name: 'AMB Cinemas Multiplex', city: 'Hyderabad', state: 'Telangana', address: 'Sarath City Capital Mall, Gachibowli' },
      { name: 'Prasads Multiplex (Large Screen)', city: 'Hyderabad', state: 'Telangana', address: 'NTR Gardens, Tank Bund Road' },
      { name: 'PVR Nexus Mall Multiplex', city: 'Hyderabad', state: 'Telangana', address: 'Nexus Mall, Kukatpally' },
      { name: 'Asian Sridevi Mall & Multiplex', city: 'Warangal', state: 'Telangana', address: 'Hanamkonda Main Road' },
      { name: 'Jagadamba 70mm Multiplex', city: 'Visakhapatnam', state: 'Andhra Pradesh', address: 'Jagadamba Centre, Vizag' },
      { name: 'INOX Varun Beach', city: 'Visakhapatnam', state: 'Andhra Pradesh', address: 'Beach Road, Vizag' },
      { name: 'Capital Cinemas (Trendset Mall)', city: 'Vijayawada', state: 'Andhra Pradesh', address: 'Benz Circle, Vijayawada' },
      { name: 'Cine Square Multiplex', city: 'Guntur', state: 'Andhra Pradesh', address: 'Brodipet 4th Lane, Guntur' },
      { name: 'PGS Multiplex', city: 'Tirupati', state: 'Andhra Pradesh', address: 'Kapila Theertham Road, Tirupati' }
    ];

    const tNames = theatersData.map(t => t.name);
    const tCities = theatersData.map(t => `${t.city} (${t.state})`);
    const tAddresses = theatersData.map(t => t.address);

    const insertedTheaters = await client.query(`
      INSERT INTO theaters (name, city, address)
      SELECT * FROM UNNEST ($1::text[], $2::text[], $3::text[])
      RETURNING id, name, city;
    `, [tNames, tCities, tAddresses]);

    const theaterIds = insertedTheaters.rows.map(t => t.id);

    // 3. Seed Screens for all Theaters (1 Screen per theater, 60 seats)
    const screenNames = [
      'Screen 1 (Dolby Atmos 4K)',
      'Screen 6 (IMAX Laser Dual 4K)',
      'Screen 2 (Dolby 7.1 Surround)',
      'Screen 1 (4K RGB Laser)',
      'Screen 1 (Dolby Atmos - 70mm)',
      'Screen 3 (Insignia Lounge)',
      'Screen 4 (Dolby Atmos Auro 11.1)',
      'Screen 2 (Barco 4K Laser)',
      'Screen 1 (Qube Master 4K)'
    ];

    const insertedScreens = await client.query(`
      INSERT INTO screens (theater_id, name, total_seats)
      SELECT t_id, s_name, 60
      FROM UNNEST ($1::int[], $2::text[]) AS s(t_id, s_name)
      RETURNING id, theater_id, name;
    `, [theaterIds, screenNames]);

    const screenIds = insertedScreens.rows.map(s => s.id);

    // 4. Seed Seats for all Screens in 1 vectorized query
    console.log('Generating auditorium seating layouts...');
    await client.query(`
      INSERT INTO seats (screen_id, row_label, seat_number, tier, price_multiplier)
      SELECT 
        s.screen_id, r.row_label, num, r.tier, r.mult
      FROM UNNEST ($1::int[]) AS s(screen_id)
      CROSS JOIN (VALUES 
        ('A', 'SILVER', 1.00), ('B', 'SILVER', 1.00),
        ('C', 'GOLD', 1.35), ('D', 'GOLD', 1.35),
        ('E', 'RECLINER', 1.80), ('F', 'RECLINER', 1.80)
      ) AS r(row_label, tier, mult)
      CROSS JOIN generate_series(1, 10) AS num
      ON CONFLICT (screen_id, row_label, seat_number) DO NOTHING;
    `, [screenIds]);

    // 5. Seed 100 Authentic Telugu Movies in 1 vectorized query
    console.log('Inserting movies...');
    const titles = teluguMovies.map(m => m.title);
    const descriptions = teluguMovies.map(m => m.description);
    const durations = teluguMovies.map(m => m.duration_mins);
    const genres = teluguMovies.map(m => m.genre);
    const posters = teluguMovies.map(m => m.poster_url);
    const ratings = teluguMovies.map(m => m.rating);

    const insertedMovies = await client.query(`
      INSERT INTO movies (title, description, duration_mins, genre, poster_url, rating)
      SELECT * FROM UNNEST ($1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::numeric[])
      RETURNING id, title;
    `, [titles, descriptions, durations, genres, posters, ratings]);

    const movieMap = {};
    for (const r of insertedMovies.rows) {
      movieMap[r.title] = r.id;
    }
    console.log(`Inserted ${insertedMovies.rows.length} movies.`);

    // 6. Schedule Shows across multiple days (Next 4 days: Today, Tomorrow, Day 2, Day 3)
    // Distributed across Telangana (Hyderabad, Warangal) and Andhra Pradesh (Vizag, Vijayawada, Guntur, Tirupati)
    console.log('Scheduling multi-day shows across Andhra Pradesh & Telangana multiplexes...');
    
    // Base date starts today at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const showStartTimes = [];
    const showEndTimes = [];
    const showMovieIds = [];
    const showScreenIds = [];
    const showBasePrices = [];

    // Slot hour offsets: 11:30 AM (11.5h), 2:45 PM (14.75h), 6:15 PM (18.25h), 9:45 PM (21.75h)
    const slots = [
      { h: 11, m: 30, price: 250.00 },
      { h: 14, m: 45, price: 275.00 },
      { h: 18, m: 15, price: 320.00 },
      { h: 21, m: 45, price: 350.00 },
    ];

    const nowTimestamp = Date.now();

    for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
      const targetDay = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);

      insertedMovies.rows.forEach((movie, mIdx) => {
        // Assign 2 distinct screens in AP & TS for each movie
        const screen1 = screenIds[mIdx % screenIds.length];
        const screen2 = screenIds[(mIdx + 4) % screenIds.length];

        // For each screen, assign show slots on this day
        // Rotate slots for variety
        const slotA = slots[(mIdx + dayOffset) % slots.length];
        const slotB = slots[(mIdx + dayOffset + 2) % slots.length];

        const time1 = new Date(targetDay);
        time1.setHours(slotA.h, slotA.m, 0, 0);
        const end1 = new Date(time1.getTime() + 170 * 60000);

        const time2 = new Date(targetDay);
        time2.setHours(slotB.h, slotB.m, 0, 0);
        const end2 = new Date(time2.getTime() + 170 * 60000);

        // Keep shows that are upcoming (start_time > now)
        if (time1.getTime() > nowTimestamp) {
          showMovieIds.push(movie.id);
          showScreenIds.push(screen1);
          showStartTimes.push(time1);
          showEndTimes.push(end1);
          showBasePrices.push(slotA.price);
        }

        if (time2.getTime() > nowTimestamp) {
          showMovieIds.push(movie.id);
          showScreenIds.push(screen2);
          showStartTimes.push(time2);
          showEndTimes.push(end2);
          showBasePrices.push(slotB.price);
        }
      });
    }

    console.log(`Inserting ${showMovieIds.length} multi-day upcoming shows...`);
    await client.query(`
      INSERT INTO shows (movie_id, screen_id, start_time, end_time, base_price)
      SELECT m_id, s_id, s_start, s_end, b_price
      FROM UNNEST ($1::int[], $2::int[], $3::timestamptz[], $4::timestamptz[], $5::numeric[]) 
        AS s(m_id, s_id, s_start, s_end, b_price);
    `, [showMovieIds, showScreenIds, showStartTimes, showEndTimes, showBasePrices]);

    // Bulk populate show_seats in 1 lightning-fast SQL query
    console.log('Generating auditorium seat inventory...');
    await client.query(`
      INSERT INTO show_seats (show_id, seat_id, status)
      SELECT s.id, st.id, 'AVAILABLE'
      FROM shows s
      JOIN seats st ON st.screen_id = s.screen_id
      ON CONFLICT (show_id, seat_id) DO NOTHING;
    `);

    // 7. Seed Verified Reviews from Audience
    const sampleReviews = [
      {
        movieTitle: 'Pushpa 2: The Rule',
        userEmail: 'sneha.reddy@example.com',
        rating: 9.0,
        text: 'Allu Arjun sheer intensity and dialogue delivery elevates this film beyond ordinary mass cinema. The interval sequence at the checkpost is thunderous.',
      },
      {
        movieTitle: 'Pushpa 2: The Rule',
        userEmail: 'ramesh.babu@example.com',
        rating: 8.8,
        text: 'Devi Sri Prasad background score gave goosebumps throughout. Top tier multiplex projection at AMB screen.',
      },
      {
        movieTitle: 'RRR',
        userEmail: 'ananya.rao@example.com',
        rating: 8.5,
        text: 'SS Rajamouli vision and execution is unparalleled. Komaram Bheemudo sequence brought tears to eyes. A modern classic of Indian cinema.',
      },
      {
        movieTitle: 'Sita Ramam',
        userEmail: 'deepika.p@example.com',
        rating: 9.0,
        text: 'One of the most poetic romantic dramas ever made in Telugu cinema. Dulquer Salman and Mrunal Thakur chemistry was heavenly.',
      },
      {
        movieTitle: 'Jersey',
        userEmail: 'suresh.naidu@example.com',
        rating: 8.8,
        text: 'Nani emotional performance in the railway station scene is pure masterclass. Anirudh emotional score takes the film to another plane.',
      },
      {
        movieTitle: 'Kalki 2898 AD',
        userEmail: 'vijay.kumar@example.com',
        rating: 7.8,
        text: 'Amitabh Bachchan as Ashwatthama was terrifyingly grand. Nag Ashwin world-building is visionary.',
      },
      {
        movieTitle: 'Lucky Baskhar',
        userEmail: 'ramesh.babu@example.com',
        rating: 8.0,
        text: 'Venky Atluri tight screenplay and Dulquer Salman effortless charm made this 90s banking thriller deeply engaging from start to finish.',
      },
      {
        movieTitle: 'Karthikeya 2',
        userEmail: 'sneha.reddy@example.com',
        rating: 8.5,
        text: 'A masterpiece in mythological thriller genre. The climax revelation at Dwarka was absolutely breathtaking and spiritually moving.',
      },
      {
        movieTitle: 'Arjun Reddy',
        userEmail: 'ananya.rao@example.com',
        rating: 8.2,
        text: 'Vijay Deverakonda gave one of the rawest and most vulnerable performances seen in Telugu cinema. A movie that left me speechless.',
      },
      {
        movieTitle: 'Magadheera',
        userEmail: 'vijay.kumar@example.com',
        rating: 8.5,
        text: 'Rajamouli created pure cinematic magic. The parallel storytelling between past and present was flawlessly executed with stunning visuals.',
      },
      {
        movieTitle: 'Pellichoopulu',
        userEmail: 'deepika.p@example.com',
        rating: 8.4,
        text: 'Fresh and relatable like no Telugu rom-com before it. Vijay Deverakonda and Ritu Varma had incredible chemistry throughout.',
      },
      {
        movieTitle: 'Colour Photo',
        userEmail: 'suresh.naidu@example.com',
        rating: 8.6,
        text: 'A heartbreaking social commentary wrapped in a beautiful love story. Suhas and Chandini Chowdary made you cry your eyes out.',
      },
      {
        movieTitle: 'C/o Kancharapalem',
        userEmail: 'ananya.rao@example.com',
        rating: 9.2,
        text: 'Absolute masterpiece of indie Telugu cinema. Heartwarming, real, unfiltered human emotions in every story.',
      }
    ];

    for (const r of sampleReviews) {
      const movieId = movieMap[r.movieTitle];
      const userId = userMap[r.userEmail];
      if (movieId && userId) {
        await client.query(`
          INSERT INTO reviews (movie_id, user_id, rating, review_text, is_verified_buyer)
          VALUES ($1, $2, $3, $4, true);
        `, [movieId, userId, r.rating, r.text]);
      }
    }

    await client.query('COMMIT');
    console.log(`🎉 Database successfully refreshed with ${insertedMovies.rows.length} movies and ${showMovieIds.length} shows across Andhra Pradesh & Telangana!`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed and was rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
