import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from './config.js';

// Ensure data directory exists
mkdirSync(dirname(config.dbPath), { recursive: true });

let db = null;

async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (existsSync(config.dbPath)) {
    const fileBuffer = readFileSync(config.dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      date TEXT,
      issue_number INTEGER,
      scraped_at TEXT,
      raw_html_path TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      description TEXT,
      category TEXT,
      is_primary_link INTEGER DEFAULT 0,
      is_crowdsourced INTEGER DEFAULT 0,
      contributor_name TEXT,
      section_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_id) REFERENCES issues(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_recommendations_category ON recommendations(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_recommendations_issue_id ON recommendations(issue_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_issues_date ON issues(date)');

  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(config.dbPath, buffer);
}

export const dbOperations = {
  async init() {
    return initDb();
  },

  // Add a new issue (newsletter edition)
  addIssue(issue) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO issues (title, url, date, issue_number, scraped_at, raw_html_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      issue.title,
      issue.url,
      issue.date || null,
      issue.issueNumber || null,
      issue.scrapedAt || null,
      issue.rawHtmlPath || null,
    ]);
    stmt.free();
    saveDb();
    return { changes: db.getRowsModified() };
  },

  // Add a recommendation
  addRecommendation(rec) {
    const stmt = db.prepare(`
      INSERT INTO recommendations (issue_id, title, url, description, category, is_primary_link, is_crowdsourced, contributor_name, section_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      rec.issueId,
      rec.title,
      rec.url || null,
      rec.description || null,
      rec.category || 'other',
      rec.isPrimaryLink ? 1 : 0,
      rec.isCrowdsourced ? 1 : 0,
      rec.contributorName || null,
      rec.sectionName || null,
    ]);
    stmt.free();
    saveDb();
  },

  // Get issue by URL
  getIssueByUrl(url) {
    const stmt = db.prepare('SELECT * FROM issues WHERE url = ?');
    stmt.bind([url]);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  },

  // Get all issues
  getAllIssues() {
    const results = [];
    const stmt = db.prepare('SELECT * FROM issues ORDER BY date DESC');
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  // Get issues that haven't been fully scraped yet
  getUnscrapedIssues() {
    const results = [];
    const stmt = db.prepare('SELECT * FROM issues WHERE scraped_at IS NULL');
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  // Update issue after scraping
  markIssueScraped(issueId, rawHtmlPath) {
    const stmt = db.prepare(
      'UPDATE issues SET scraped_at = ?, raw_html_path = ? WHERE id = ?'
    );
    stmt.run([new Date().toISOString(), rawHtmlPath, issueId]);
    stmt.free();
    saveDb();
  },

  // Get recommendations for an issue
  getRecommendationsByIssue(issueId) {
    const results = [];
    const stmt = db.prepare('SELECT * FROM recommendations WHERE issue_id = ?');
    stmt.bind([issueId]);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  // Search recommendations
  searchRecommendations(query) {
    const results = [];
    const stmt = db.prepare(`
      SELECT r.*, i.title as issue_title, i.date as issue_date
      FROM recommendations r
      JOIN issues i ON r.issue_id = i.id
      WHERE r.title LIKE ? OR r.description LIKE ?
      ORDER BY i.date DESC
    `);
    stmt.bind([`%${query}%`, `%${query}%`]);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  // Get recommendations by category
  getByCategory(category) {
    const results = [];
    const stmt = db.prepare(`
      SELECT r.*, i.title as issue_title, i.date as issue_date
      FROM recommendations r
      JOIN issues i ON r.issue_id = i.id
      WHERE r.category = ?
      ORDER BY i.date DESC
    `);
    stmt.bind([category]);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  // Get stats
  getStats() {
    const totalIssues = db.exec('SELECT COUNT(*) as count FROM issues')[0]?.values[0][0] || 0;
    const totalRecs = db.exec('SELECT COUNT(*) as count FROM recommendations')[0]?.values[0][0] || 0;

    const byCategoryResult = db.exec(`
      SELECT category, COUNT(*) as count
      FROM recommendations
      GROUP BY category
      ORDER BY count DESC
    `);

    const byCategory = byCategoryResult[0]?.values.map(row => ({
      category: row[0],
      count: row[1],
    })) || [];

    return {
      totalIssues,
      totalRecommendations: totalRecs,
      byCategory,
    };
  },

  // Save and close
  close() {
    if (db) {
      saveDb();
      db.close();
      db = null;
    }
  },

  // Direct db access for export
  getDb() {
    return db;
  },
};

export default dbOperations;
