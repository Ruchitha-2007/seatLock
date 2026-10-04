-- 004_review_enhancements.sql
-- Allow users to post multiple reviews or separate reviews per visit, and enable clean deletion
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_user_movie_review;
