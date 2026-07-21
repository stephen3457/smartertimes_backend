require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const watchRoutes = require('./routes/watchRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// Security & Middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/watches', watchRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    message: 'Smarter Times API Server is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// Serve Angular static frontend build in production if available
const frontendDistPath = path.join(__dirname, '../frontend/dist/frontend/browser');
if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
  });
}

// Auto Seed Admin Function
const seedAdmin = async () => {
  try {
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@SmarterTimes2026';

    const existingAdmin = await User.findOne({ username: adminUsername });
    if (!existingAdmin) {
      await User.create({
        username: adminUsername,
        password: adminPassword,
        name: 'System Admin',
        role: 'admin',
      });
      console.log(`[SEED] Default Admin user created (${adminUsername})`);
    } else {
      console.log(`[SEED] Admin user (${adminUsername}) already exists`);
    }
  } catch (error) {
    console.error('[SEED ERROR] Failed to seed admin user:', error.message);
  }
};

// Database Connection & Server Initialization
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in environment variables.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB Atlas database');
    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` Smarter Times Backend Server is listening`);
      console.log(` Server running on http://localhost:${PORT}`);
      console.log(`===============================================`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Atlas connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
