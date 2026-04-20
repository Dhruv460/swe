// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

// Import API routes
const Vehicle = require('./Vehicle');
const authRoutes = require('./auth');
const vehicleRoutes = require('./vehicles');

// --- App & Server Setup ---
const app = express();
const server = http.createServer(app);

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB Connected successfully.'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));


// --- Middleware ---
// Enable CORS to allow requests from your React frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN
}));
// Parse JSON bodies for API requests
app.use(express.json());


// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
// app.use('/api/routes', routeRoutes); // We will add this later

// --- Socket.IO Real-time Layer ---
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 A user connected with socket ID: ${socket.id}`);

  // Listen for a driver updating their location
  socket.on('updateLocation', async (data) => {
    console.log('🛰️  Received location update:', data);
    const { vehicleId, coordinates, vehicleInfo } = data;

    try {
      // 1. Update vehicle location in the database ONLY if it's a valid DB ID
      if (mongoose.Types.ObjectId.isValid(vehicleId)) {
        await Vehicle.findByIdAndUpdate(
          vehicleId,
          {
            lastLocation: { type: 'Point', coordinates: [coordinates.longitude, coordinates.latitude] },
            lastUpdate: Date.now(),
            status: 'active',
          },
          { new: true }
        );
      }
      // 2. Broadcast the new location to all OTHER connected clients (students)
      socket.broadcast.emit('locationUpdate', { vehicleId, coordinates, vehicleInfo });
    } catch (error) {
      console.error("Error updating location:", error);
    }
  });

  // Listen for a driver ending their shift
  socket.on('stopTracking', async (data) => {
    console.log('🛑 Driver stopped tracking:', data);
    const { vehicleId } = data;
    try {
      // Update database status to inactive
      if (mongoose.Types.ObjectId.isValid(vehicleId)) {
        await Vehicle.findByIdAndUpdate(vehicleId, { status: 'inactive' });
      }
      // Tell all students to remove this vehicle from their map
      socket.broadcast.emit('vehicleOffline', { vehicleId });
    } catch (error) {
      console.error("Error stopping tracking:", error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User with socket ID ${socket.id} disconnected.`);
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});