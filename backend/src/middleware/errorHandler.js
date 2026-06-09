const errorHandler = (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
    res.status(status).json({ detail: message });
};

module.exports = errorHandler;
