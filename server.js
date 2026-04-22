require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const initializeFirebase = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');
const socketHandler = require('./socket/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Initialize Firebase
const { db } = initializeFirebase();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/sessions', require('./routes/sessions')(db));
app.use('/api/stats', require('./routes/stats')(db));
app.use('/api/settings', require('./routes/settings')(db));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Ledo Friend API', version: '1.0.0' });
});

// Socket.io
socketHandler(io, db);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Ledo Friend Server running on port ${PORT}`);
});
