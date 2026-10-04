-- ==========================================================
-- 001_init_schema.sql: Core Cinema Multiplex Relational Schema
-- ==========================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'ADMIN')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. THEATERS TABLE
CREATE TABLE IF NOT EXISTS theaters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SCREENS TABLE
CREATE TABLE IF NOT EXISTS screens (
    id SERIAL PRIMARY KEY,
    theater_id INT NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    total_seats INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PHYSICAL SEATS TABLE (Static auditorium layout)
CREATE TABLE IF NOT EXISTS seats (
    id SERIAL PRIMARY KEY,
    screen_id INT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    row_label VARCHAR(5) NOT NULL,
    seat_number INT NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('SILVER', 'GOLD', 'RECLINER')),
    price_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    CONSTRAINT uq_screen_seat UNIQUE (screen_id, row_label, seat_number)
);

-- 5. MOVIES TABLE
CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    duration_mins INT NOT NULL CHECK (duration_mins > 0),
    genre VARCHAR(50),
    poster_url TEXT,
    rating VARCHAR(10) DEFAULT 'PG-13',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SHOWS TABLE
CREATE TABLE IF NOT EXISTS shows (
    id SERIAL PRIMARY KEY,
    movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    screen_id INT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_show_time CHECK (end_time > start_time)
);

-- 7. SHOW SEATS TABLE (The Concurrency Heart - State per seat per show)
CREATE TABLE IF NOT EXISTS show_seats (
    id SERIAL PRIMARY KEY,
    show_id INT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_id INT NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED')),
    held_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    held_until TIMESTAMP WITH TIME ZONE,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_show_seat UNIQUE (show_id, seat_id)
);

-- 8. BOOKINGS TABLE (Immutable audit record of confirmed orders)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    booking_reference VARCHAR(36) UNIQUE NOT NULL,
    show_id INT NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. BOOKING SEATS TABLE
CREATE TABLE IF NOT EXISTS booking_seats (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_seat_id INT NOT NULL REFERENCES show_seats(id) ON DELETE RESTRICT,
    price_paid NUMERIC(10, 2) NOT NULL CHECK (price_paid >= 0),
    CONSTRAINT uq_booking_seat UNIQUE (booking_id, show_seat_id)
);

-- 10. PAYMENTS TABLE (With Idempotency enforcement)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'MOCK_CARD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- INDEXES FOR HIGH-PERFORMANCE CONCURRENCY & SUB-MS LOOKUPS
-- ==========================================================

-- Fast seat status lookup for real-time seat map rendering
CREATE INDEX IF NOT EXISTS idx_show_seats_lookup 
ON show_seats (show_id, status);

-- Partial index for high-speed expired hold sweepers
CREATE INDEX IF NOT EXISTS idx_show_seats_expired_holds 
ON show_seats (held_until) 
WHERE status = 'HELD';

-- Fast show retrieval by movie and start time
CREATE INDEX IF NOT EXISTS idx_shows_movie_time 
ON shows (movie_id, start_time);

-- Fast booking retrieval for user dashboard
CREATE INDEX IF NOT EXISTS idx_bookings_user 
ON bookings (user_id, created_at DESC);
