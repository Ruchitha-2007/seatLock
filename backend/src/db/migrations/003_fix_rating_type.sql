-- 003_fix_rating_type.sql
ALTER TABLE reviews ALTER COLUMN rating TYPE NUMERIC(3, 1);
