-- Update payments status check constraint to support PENDING_AT_COUNTER and CANCELLED
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'PENDING_AT_COUNTER', 'CANCELLED'));
