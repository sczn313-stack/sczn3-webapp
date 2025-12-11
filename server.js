const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the static index.html from the same directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Simple test API route
app.post('/api/sec', (req, res) => {
  const { windage, elevation } = req.body || {};
  res.json({
    status: 'ok',
    message: 'SCZN3 SEC backend is alive.',
    received: { windage, elevation }
  });
});

app.listen(PORT, () => {
  console.log(`SCZN3 webapp listening on port ${PORT}`);
});
