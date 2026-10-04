-- Add hype_count to movies table
ALTER TABLE movies ADD COLUMN IF NOT EXISTS hype_count INT NOT NULL DEFAULT 0;

-- Seed baseline audience hype counts
UPDATE movies
SET hype_count = CASE 
  WHEN title ILIKE '%pushpa 2%' THEN 48500
  WHEN title ILIKE '%kalki%' THEN 43200
  WHEN title ILIKE '%devara%' THEN 39800
  WHEN title ILIKE '%rrr%' THEN 36400
  WHEN title ILIKE '%baahubali 2%' THEN 35100
  WHEN title ILIKE '%hanu-man%' OR title ILIKE '%hanuman%' THEN 31900
  WHEN title ILIKE '%salaar%' THEN 29400
  WHEN title ILIKE '%game changer%' THEN 26800
  WHEN title ILIKE '%og%' THEN 25500
  WHEN title ILIKE '%jersey%' THEN 22400
  WHEN title ILIKE '%sita ramam%' THEN 21800
  WHEN title ILIKE '%pokiri%' THEN 20500
  WHEN title ILIKE '%rangasthalam%' THEN 19800
  WHEN title ILIKE '%attarintiki%' THEN 18700
  ELSE FLOOR(5000 + (rating::numeric * 1400) + (id * 37))::int
END
WHERE hype_count = 0;
