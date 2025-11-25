/**
 * Admin Server
 * Serves the public folder and provides API endpoints for editing recommendations
 */

import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// Paths
const dataPath = join(__dirname, '..', 'data', 'installer-archive.json');
const publicPath = join(__dirname, '..', 'public');

// Middleware
app.use(express.json());
app.use(express.static(publicPath));

// Load data
let data = { issues: [], recommendations: [] };

function loadData() {
  if (existsSync(dataPath)) {
    data = JSON.parse(readFileSync(dataPath, 'utf8'));
    console.log(`Loaded ${data.recommendations.length} recommendations from ${data.issues.length} issues`);
  }
}

function saveData() {
  writeFileSync(dataPath, JSON.stringify(data, null, 2));
  // Also update the public copy
  writeFileSync(join(publicPath, 'data', 'installer-archive.json'), JSON.stringify(data, null, 2));
  console.log('Data saved');
}

// API Routes

// Get all recommendations with optional filters
app.get('/api/recommendations', (req, res) => {
  let results = [...data.recommendations];

  // Filter by category
  if (req.query.category) {
    results = results.filter(r => r.category === req.query.category);
  }

  // Filter by issue
  if (req.query.issueId) {
    results = results.filter(r => r.issueId == req.query.issueId);
  }

  // Search
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    results = results.filter(r =>
      r.title?.toLowerCase().includes(search) ||
      r.description?.toLowerCase().includes(search) ||
      r.url?.toLowerCase().includes(search)
    );
  }

  res.json({
    total: results.length,
    recommendations: results
  });
});

// Get all issues
app.get('/api/issues', (req, res) => {
  res.json(data.issues);
});

// Update a recommendation
app.patch('/api/recommendations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const rec = data.recommendations.find(r => r.id === id);

  if (!rec) {
    return res.status(404).json({ error: 'Recommendation not found' });
  }

  // Update allowed fields
  const allowedFields = ['category', 'title', 'tags', 'hidden', 'url', 'dead'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      rec[field] = req.body[field];
    }
  }

  saveData();
  res.json(rec);
});

// Bulk update categories
app.post('/api/recommendations/bulk-update', (req, res) => {
  const { ids, category } = req.body;

  if (!ids || !Array.isArray(ids) || !category) {
    return res.status(400).json({ error: 'ids array and category required' });
  }

  let updated = 0;
  for (const id of ids) {
    const rec = data.recommendations.find(r => r.id === id);
    if (rec) {
      rec.category = category;
      updated++;
    }
  }

  saveData();
  res.json({ updated });
});

// Delete a recommendation (hide it)
app.delete('/api/recommendations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = data.recommendations.findIndex(r => r.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Recommendation not found' });
  }

  // Mark as hidden instead of deleting
  data.recommendations[idx].hidden = true;
  saveData();
  res.json({ success: true });
});

// Get stats
app.get('/api/stats', (req, res) => {
  const stats = {
    totalIssues: data.issues.length,
    totalRecommendations: data.recommendations.length,
    visibleRecommendations: data.recommendations.filter(r => !r.hidden).length,
    byCategory: {}
  };

  for (const rec of data.recommendations) {
    if (!rec.hidden) {
      stats.byCategory[rec.category] = (stats.byCategory[rec.category] || 0) + 1;
    }
  }

  res.json(stats);
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(join(publicPath, 'admin.html'));
});

// Start server
loadData();
app.listen(PORT, () => {
  console.log(`\nInstaller Archive Admin Server`);
  console.log(`================================`);
  console.log(`Public site: http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
