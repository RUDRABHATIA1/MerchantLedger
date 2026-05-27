require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');

// ── Logger ─────────────────────────────────────────────────────────────────
const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console({ format: format.combine(format.colorize(), format.simple()) })],
});

const app = express();

// ── Security Middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: 'Too many requests' });
app.use('/api/', limiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./src/routes/auth'));
app.use('/api/parties',      require('./src/routes/parties'));
app.use('/api/accounts',     require('./src/routes/accounts'));
app.use('/api/transactions', require('./src/routes/transactions'));
app.use('/api/reports',      require('./src/routes/reports'));
app.use('/api/audit-logs',   require('./src/routes/auditLogs'));
app.use('/api/users',        require('./src/routes/users'));
app.use('/api/items',        require('./src/routes/items'));
app.use('/api/manufacturing', require('./src/routes/manufacturing'));

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Serve frontend build in production ─────────────────────────────────────
const frontendDist = path.join(__dirname, 'public');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (req.path === '/health') return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  const status = err.statusCode || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
});

// ── DB + Server Bootstrap ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paymentledger';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    logger.info('✅  MongoDB connected');
    app.listen(PORT, () => logger.info(`🚀  Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('❌  MongoDB connection failed', { error: err.message });
    process.exit(1);
  });
