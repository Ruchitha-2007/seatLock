export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });
    // Attach validated and sanitized data back to req
    req.validated = parsed;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.errors?.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })) || error.message,
    });
  }
};
