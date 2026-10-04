-- ==========================================================
-- 009_audience_demands.sql: Audience Demands & Movie Voting
-- ==========================================================

CREATE TABLE IF NOT EXISTS movie_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    genre VARCHAR(100),
    release_year INT,
    target_city VARCHAR(100) DEFAULT 'All AP & Telangana',
    poster_url TEXT,
    trailer_url TEXT,
    status VARCHAR(50) DEFAULT 'VOTING' CHECK (status IN ('VOTING', 'GREENLIT', 'SCHEDULED', 'REJECTED')),
    vote_count INT DEFAULT 1,
    target_threshold INT DEFAULT 25,
    greenlit_movie_id INT REFERENCES movies(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movie_request_votes (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES movie_requests(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_request_user_vote UNIQUE (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_requests_status ON movie_requests(status, vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_movie_request_votes ON movie_request_votes(request_id, user_id);
