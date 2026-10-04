-- Migration 011: Expand all multiplexes with full screen suites & seat maps

-- 1. Insert realistic multi-screens for all multiplex theaters
INSERT INTO screens (theater_id, name, total_seats)
SELECT t.id, s.name, 60
FROM (
  VALUES
    -- AMB Cinemas Multiplex (Hyderabad)
    ('AMB Cinemas Multiplex', 'Screen 2 (Dolby Atmos 3D)'),
    ('AMB Cinemas Multiplex', 'Screen 3 (Barco Laser 4K)'),
    ('AMB Cinemas Multiplex', 'Screen 4 (VIP Lounge)'),
    ('AMB Cinemas Multiplex', 'Screen 5 (Dolby 7.1)'),
    ('AMB Cinemas Multiplex', 'Screen 6 (Superplex Large Screen)'),

    -- Prasads Multiplex (Hyderabad)
    ('Prasads Multiplex (Large Screen)', 'Screen 1 (Dolby Atmos 4K)'),
    ('Prasads Multiplex (Large Screen)', 'Screen 2 (Large Screen 70mm)'),
    ('Prasads Multiplex (Large Screen)', 'Screen 3 (4K RGB Laser)'),
    ('Prasads Multiplex (Large Screen)', 'Screen 4 (Dolby 7.1 Surround)'),
    ('Prasads Multiplex (Large Screen)', 'Screen 5 (Gold Class)'),

    -- PVR Nexus Mall Multiplex (Hyderabad)
    ('PVR Nexus Mall Multiplex', 'Screen 1 (PVR P[XL] Atmos)'),
    ('PVR Nexus Mall Multiplex', 'Screen 3 (4K Laser Projection)'),
    ('PVR Nexus Mall Multiplex', 'Screen 4 (Dolby Atmos 3D)'),
    ('PVR Nexus Mall Multiplex', 'Screen 5 (Gold Class Lounge)'),

    -- Asian Sridevi Mall & Multiplex (Warangal)
    ('Asian Sridevi Mall & Multiplex', 'Screen 2 (Dolby Atmos)'),
    ('Asian Sridevi Mall & Multiplex', 'Screen 3 (Dolby 7.1 Surround)'),
    ('Asian Sridevi Mall & Multiplex', 'Screen 4 (Qube 4K Laser)'),

    -- Jagadamba 70mm Multiplex (Vizag)
    ('Jagadamba 70mm Multiplex', 'Screen 2 (Sharada 4K Laser)'),
    ('Jagadamba 70mm Multiplex', 'Screen 3 (Ramadevi Dolby Atmos)'),
    ('Jagadamba 70mm Multiplex', 'Screen 4 (Mini Screen 7.1)'),

    -- INOX Varun Beach (Vizag)
    ('INOX Varun Beach', 'Screen 1 (IMAX with Laser)'),
    ('INOX Varun Beach', 'Screen 2 (Dolby Atmos 4K)'),
    ('INOX Varun Beach', 'Screen 4 (Kiddles Club)'),
    ('INOX Varun Beach', 'Screen 5 (Dolby 7.1 Surround)'),
    ('INOX Varun Beach', 'Screen 6 (Club Lounge)'),

    -- Capital Cinemas (Trendset Mall - Vijayawada)
    ('Capital Cinemas (Trendset Mall)', 'Screen 1 (Auro 3D 4K)'),
    ('Capital Cinemas (Trendset Mall)', 'Screen 2 (Dolby Atmos 4K)'),
    ('Capital Cinemas (Trendset Mall)', 'Screen 3 (Barco 4K Laser)'),
    ('Capital Cinemas (Trendset Mall)', 'Screen 5 (Dolby 7.1 Surround)'),
    ('Capital Cinemas (Trendset Mall)', 'Screen 6 (VIP Recliner Suite)'),
    ('Capital Cinemas (Trendset Mall)', 'Screen 7 (4K RGB Laser)'),

    -- Cine Square Multiplex (Guntur)
    ('Cine Square Multiplex', 'Screen 1 (Dolby Atmos 4K)'),
    ('Cine Square Multiplex', 'Screen 3 (Dolby 7.1 Surround)'),
    ('Cine Square Multiplex', 'Screen 4 (Qube 4K)'),

    -- PGS Multiplex (Tirupati)
    ('PGS Multiplex', 'Screen 2 (Dolby Atmos 4K)'),
    ('PGS Multiplex', 'Screen 3 (Dolby 7.1 Surround)'),
    ('PGS Multiplex', 'Screen 4 (Barco 4K Laser)')
) AS s(t_name, name)
JOIN theaters t ON t.name = s.t_name
WHERE NOT EXISTS (
  SELECT 1 FROM screens sc WHERE sc.theater_id = t.id AND sc.name = s.name
);

-- 2. Seed Seats (60 seats each: Silver, Gold, Recliner) for all screens missing seats
INSERT INTO seats (screen_id, row_label, seat_number, tier, price_multiplier)
SELECT 
  sc.id, r.row_label, num, r.tier, r.mult
FROM screens sc
CROSS JOIN (VALUES 
  ('A', 'SILVER', 1.00), ('B', 'SILVER', 1.00),
  ('C', 'GOLD', 1.35), ('D', 'GOLD', 1.35),
  ('E', 'RECLINER', 1.80), ('F', 'RECLINER', 1.80)
) AS r(row_label, tier, mult)
CROSS JOIN generate_series(1, 10) AS num
WHERE NOT EXISTS (
  SELECT 1 FROM seats st WHERE st.screen_id = sc.id AND st.row_label = r.row_label AND st.seat_number = num
);
