const express = require('express');
const app = express();

const testPath = '/api/cloud-storage';
app.use(testPath, (req, res, next) => {
  console.log('Middleware matched for:', req.path);
  next();
});

app.get('/api/cloud-storage/gdrive/status', (req, res) => {
  res.json({ success: true, test: 'gdrive status' });
});

const request = require('supertest')(app);
request(app)
  .get('/api/cloud-storage/gdrive/status')
  .then(res => {
    console.log('Response status:', res.status);
    console.log('Response body:', res.body);
  })
  .catch(err => console.error('Error:', err.message));
