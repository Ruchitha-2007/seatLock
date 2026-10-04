import { query } from '../config/db.js';

let isRunning = false;

/**
 * Sweeper task that runs every 30 seconds to clean up abandoned seat holds
 * where held_until has passed.
 */
export const sweepExpiredHolds = async () => {
  if (isRunning) return; // Prevent concurrent sweeper overlapping
  isRunning = true;

  try {
    const result = await query(`
      UPDATE show_seats
      SET 
        status = 'AVAILABLE',
        held_by_user_id = NULL,
        held_until = NULL,
        version = version + 1,
        updated_at = NOW()
      WHERE status = 'HELD' AND held_until < NOW()
      RETURNING id;
    `);

    if (result.rowCount > 0) {
      console.log(`🧹 [Sweeper] Recycled ${result.rowCount} expired seat holds back to AVAILABLE.`);
    }
  } catch (error) {
    console.error('⚠️ [Sweeper] Error recycling expired holds:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Starts the periodic background sweeper
 */
export const startHoldSweeper = (intervalMs = 30000) => {
  console.log(`⏱️ Hold sweeper worker initiated (running every ${intervalMs / 1000}s)...`);
  const intervalId = setInterval(sweepExpiredHolds, intervalMs);
  return () => clearInterval(intervalId);
};
