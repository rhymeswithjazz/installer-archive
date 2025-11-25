/**
 * Export database to JSON for frontend consumption
 */

import { writeFileSync, mkdirSync } from 'fs';
import dbOperations from './db.js';

mkdirSync('./data', { recursive: true });

async function exportToJson() {
  console.log('Exporting database to JSON...\n');

  // Initialize database
  await dbOperations.init();

  // Get all data
  const issues = dbOperations.getAllIssues();
  const stats = dbOperations.getStats();

  // Get all recommendations with issue info
  const allRecommendations = [];
  for (const issue of issues) {
    const recs = dbOperations.getRecommendationsByIssue(issue.id);
    for (const rec of recs) {
      allRecommendations.push({
        ...rec,
        issueTitle: issue.title,
        issueDate: issue.date,
        issueUrl: issue.url,
      });
    }
  }

  // Create export object
  const exportData = {
    exportedAt: new Date().toISOString(),
    stats: {
      totalIssues: stats.totalIssues,
      totalRecommendations: stats.totalRecommendations,
      byCategory: stats.byCategory,
    },
    issues: issues.map(issue => ({
      id: issue.id,
      title: issue.title,
      url: issue.url,
      date: issue.date,
      issueNumber: issue.issue_number,
    })),
    recommendations: allRecommendations.map(rec => ({
      id: rec.id,
      title: rec.title,
      url: rec.url,
      description: rec.description,
      category: rec.category,
      isPrimaryLink: !!rec.is_primary_link,
      isCrowdsourced: !!rec.is_crowdsourced,
      contributorName: rec.contributor_name,
      sectionName: rec.section_name,
      issueId: rec.issue_id,
      issueTitle: rec.issueTitle,
      issueDate: rec.issueDate,
    })),
  };

  // Write full export
  writeFileSync('./data/installer-archive.json', JSON.stringify(exportData, null, 2));
  console.log('Wrote: ./data/installer-archive.json');

  // Write minified version for production
  writeFileSync('./data/installer-archive.min.json', JSON.stringify(exportData));
  console.log('Wrote: ./data/installer-archive.min.json');

  // Write category-specific files
  const categorizedRecs = {};
  for (const rec of allRecommendations) {
    const cat = rec.category || 'other';
    if (!categorizedRecs[cat]) {
      categorizedRecs[cat] = [];
    }
    categorizedRecs[cat].push(rec);
  }

  for (const [category, recs] of Object.entries(categorizedRecs)) {
    writeFileSync(`./data/category-${category}.json`, JSON.stringify(recs, null, 2));
    console.log(`Wrote: ./data/category-${category}.json (${recs.length} items)`);
  }

  console.log('\nExport complete!');
  console.log(`Total issues: ${stats.totalIssues}`);
  console.log(`Total recommendations: ${stats.totalRecommendations}`);

  dbOperations.close();
}

exportToJson().catch(console.error);
