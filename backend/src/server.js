import app from './app.js';
import { testConnection, pool } from './config/db.js';
import { startHoldSweeper } from './workers/holdSweeper.js';
import { runMigrations } from './db/migrate.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('🚀 Initializing SeatLock Backend Engine...');

    // 1. Verify PostgreSQL connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Could not connect to PostgreSQL. Please verify DATABASE_URL in .env');
      process.exit(1);
    }

    // 2. Run schema migrations
    await runMigrations();

    // 3. Start background hold sweeper worker
    const stopSweeper = startHoldSweeper(30000); // Check every 30s

    // 4. Start HTTP Server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎬 SeatLock Server listening on port ${PORT}`);
      console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
    });

    // 5. Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      stopSweeper();
      server.close(async () => {
        console.log('🚪 HTTP server closed.');
        await pool.end();
        console.log('🔒 Database connection pool closed.');
        process.exit(0);
      });

      // Force exit after 10s if shutdown hangs
      setTimeout(() => {
        console.error('⏰ Forcefully shutting down after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('💥 Fatal error during server startup:', error);
    process.exit(1);
  }
};

startServer();
