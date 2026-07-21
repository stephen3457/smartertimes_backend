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
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Comprehensive CORS setup allowing frontend domain + localhost + Vercel apps
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serverless-Friendly MongoDB Connection Middleware
let isConnected = false;
let dbConnectPromise = null;

const seedAdmin = async () => {
  try {
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPassword = (process.env.ADMIN_PASSWORD || 'Admin@SmarterTimes2026').trim();

    let existingAdmin = await User.findOne({ username: adminUsername });
    if (!existingAdmin) {
      await User.create({
        username: adminUsername,
        password: adminPassword,
        name: 'System Admin',
        role: 'admin',
      });
      console.log(`[SEED] Default Admin user created (${adminUsername})`);
    } else {
      const isMatch = await existingAdmin.comparePassword(adminPassword);
      if (!isMatch) {
        existingAdmin.password = adminPassword;
        await existingAdmin.save();
        console.log(`[SEED] Admin password synced (${adminUsername})`);
      } else {
        console.log(`[SEED] Admin user (${adminUsername}) verified`);
      }
    }
  } catch (error) {
    console.error('[SEED ERROR] Failed to seed/sync admin user:', error.message);
  }
};

const connectDBMiddleware = async (req, res, next) => {
  if (req.path === '/api/health') {
    return next();
  }
  try {
    if (!isConnected && mongoose.connection.readyState !== 1) {
      if (!dbConnectPromise) {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
          return res.status(500).json({
            success: false,
            message: 'CRITICAL: MONGODB_URI environment variable missing on server configuration.',
          });
        }
        dbConnectPromise = mongoose.connect(mongoUri).then(async () => {
          isConnected = true;
          console.log('Successfully connected to MongoDB Atlas database');
          await seedAdmin();
        });
      }
      await dbConnectPromise;
    }
    next();
  } catch (err) {
    dbConnectPromise = null;
    console.error('MongoDB Atlas connection error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Database Connection Error: ' + err.message,
    });
  }
};

app.use(connectDBMiddleware);

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
    dbConnected: mongoose.connection.readyState === 1,
  });
});

// Serve Angular static frontend build in production if available locally
const frontendDistPath = path.join(__dirname, '../frontend/dist/frontend/browser');
if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
  });
}

// Local standalone server startup
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && mongoose.connection.readyState !== 1) {
    mongoose.connect(mongoUri).then(async () => {
      isConnected = true;
      console.log('Successfully connected to MongoDB Atlas database');
      await seedAdmin();
    });
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` Smarter Times Backend Server is listening`);
    console.log(` Server running on http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

module.exports = app;
