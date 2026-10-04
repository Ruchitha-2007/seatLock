export const errorHandler = (err, req, res, next) => {
  console.error('🔥 Server Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  // Handle PostgreSQL specific error codes
  if (err.code === '23505') {
    // Unique violation
    return res.status(409).json({
      success: false,
      error: 'Conflict: A record with this unique value already exists.',
      detail: err.detail,
    });
  }

  if (err.code === '40P01') {
    // Deadlock detected
    return res.status(409).json({
      success: false,
      error: 'Transaction conflict / deadlock detected. Please retry your request.',
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
};
