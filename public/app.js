// Installer Archive - Search Application

let data = null;
let fuse = null;
let currentResults = [];

// DOM Elements
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const issueFilter = document.getElementById('issue-filter');
const tagFilter = document.getElementById('tag-filter');
const resultsContainer = document.getElementById('results');
const totalCount = document.getElementById('total-count');
const issueCount = document.getElementById('issue-count');
const resultsCount = document.getElementById('results-count');

// Initialize
async function init() {
  try {
    // Load data
    const response = await fetch('data/installer-archive.json');
    data = await response.json();

    // Filter out hidden and dead items for public view
    data.recommendations = data.recommendations.filter(r => !r.hidden && !r.dead);

    // Update stats
    totalCount.textContent = data.recommendations.length;
    issueCount.textContent = data.issues.length;

    // Populate filters
    populateIssueFilter();
    populateTagFilter();

    // Initialize Fuse.js for fuzzy search (include tags)
    fuse = new Fuse(data.recommendations, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1 },
        { name: 'tags', weight: 1.5 },
        { name: 'issueTitle', weight: 0.5 }
      ],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2
    });

    // Initial render
    currentResults = [...data.recommendations];
    renderResults(currentResults);

    // Set up event listeners
    setupEventListeners();

  } catch (error) {
    console.error('Error loading data:', error);
    resultsContainer.innerHTML = `
      <div class="no-results">
        Error loading data. Make sure the data files are in the public/data/ folder.
      </div>
    `;
  }
}

// Populate issue dropdown
function populateIssueFilter() {
  const sortedIssues = [...data.issues].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return 0;
  });

  sortedIssues.forEach(issue => {
    const option = document.createElement('option');
    option.value = issue.id;
    const dateStr = issue.date ? ` (${formatDate(issue.date)})` : '';
    option.textContent = truncate(issue.title, 50) + dateStr;
    issueFilter.appendChild(option);
  });
}

// Populate tag dropdown
function populateTagFilter() {
  const allTags = new Set();
  data.recommendations.forEach(rec => {
    (rec.tags || []).forEach(tag => allTags.add(tag));
  });

  [...allTags].sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    tagFilter.appendChild(option);
  });
}

// Set up event listeners
function setupEventListeners() {
  // Debounced search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 200);
  });

  // Filters
  categoryFilter.addEventListener('change', performSearch);
  issueFilter.addEventListener('change', performSearch);
  tagFilter.addEventListener('change', performSearch);
}

// Perform search and filter
function performSearch() {
  const query = searchInput.value.trim();
  const category = categoryFilter.value;
  const issueId = issueFilter.value;
  const tag = tagFilter.value;

  let results;

  // Start with search or all results
  if (query.length >= 2) {
    results = fuse.search(query).map(r => r.item);
  } else {
    results = [...data.recommendations];
  }

  // Apply category filter
  if (category) {
    results = results.filter(r => r.category === category);
  }

  // Apply issue filter
  if (issueId) {
    results = results.filter(r => r.issueId == issueId);
  }

  // Apply tag filter
  if (tag) {
    results = results.filter(r => (r.tags || []).includes(tag));
  }

  currentResults = results;
  renderResults(results);
}

// Render results
function renderResults(results) {
  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="no-results">
        No recommendations found. Try a different search or filter.
      </div>
    `;
    resultsCount.textContent = 'No results';
    return;
  }

  resultsCount.textContent = `Showing ${results.length} result${results.length !== 1 ? 's' : ''}`;

  const html = `
    <div class="results-grid">
      ${results.slice(0, 100).map(rec => createCard(rec)).join('')}
    </div>
    ${results.length > 100 ? `
      <div class="no-results">
        Showing first 100 results. Use search or filters to narrow down.
      </div>
    ` : ''}
  `;

  resultsContainer.innerHTML = html;
}

// Create a result card
function createCard(rec) {
  const domain = rec.url ? extractDomain(rec.url) : '';
  const issueLink = rec.issueId ? getIssueUrl(rec.issueId) : '#';

  const tagsHtml = (rec.tags && rec.tags.length > 0)
    ? `<div class="card-tags">${rec.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  return `
    <article class="card">
      <div class="card-category">
        <span class="category-badge category-${rec.category || 'articles'}">${rec.category || 'other'}</span>
      </div>
      <div class="card-content">
        <h3 class="card-title">
          ${rec.url
            ? `<a href="${escapeHtml(rec.url)}" target="_blank" rel="noopener">${escapeHtml(rec.title)}</a>`
            : escapeHtml(rec.title)
          }
        </h3>
        ${rec.description ? `<p class="card-description">${escapeHtml(truncate(cleanDescription(rec.description), 150))}</p>` : ''}
        ${tagsHtml}
        <div class="card-meta">
          From: <a href="${escapeHtml(issueLink)}" target="_blank" rel="noopener">${escapeHtml(rec.issueTitle || 'Unknown Issue')}</a>
          ${rec.issueDate ? ` &middot; ${formatDate(rec.issueDate)}` : ''}
        </div>
        ${domain ? `<div class="card-url">${escapeHtml(domain)}</div>` : ''}
      </div>
    </article>
  `;
}

// Helper functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + '...';
}

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function cleanDescription(text) {
  if (!text) return '';
  // Remove excessive whitespace and clean up
  return text.replace(/\s+/g, ' ').trim();
}

function getIssueUrl(issueId) {
  const issue = data.issues.find(i => i.id == issueId);
  return issue?.url || '#';
}

// Start the app
init();
