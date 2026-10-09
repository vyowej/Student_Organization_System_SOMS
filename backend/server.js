const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// USER RELATED: Route for authentication and student/officer/admin users
app.use('/api/users', require('./routes/users'));

// DATA RELATED: Route for managing organizations, memberships, etc.
app.use('/api/organizations', require('./routes/organizations'));

// DATA RELATED: Route for managing events and activities
app.use('/api/events', require('./routes/events'));

// Basic health check route
app.get('/', (req, res) => {
  res.send('SOMS API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
