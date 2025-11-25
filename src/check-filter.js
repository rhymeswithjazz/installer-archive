import dbOperations from './db.js';

await dbOperations.init();
const allIssues = dbOperations.getAllIssues();

const valid = allIssues.filter(i =>
  i.title &&
  i.title.length > 15 &&
  !i.title.includes('Comment') &&
  !i.title.includes('See All') &&
  i.url &&
  i.url.includes('theverge.com') &&
  (i.url.includes('/installer-newsletter/') || i.url.match(/\/\d{4}\/\d{1,2}\/\d{1,2}\//))
);

console.log('Total entries in DB:', allIssues.length);
console.log('Valid newsletters:', valid.length);
console.log('Already scraped:', valid.filter(v => v.scraped_at).length);
console.log('Ready to parse:', valid.filter(v => !v.scraped_at).length);
console.log('');
console.log('Sample valid issues:');
valid.slice(0, 10).forEach(i => console.log(' -', i.title.substring(0, 50)));
