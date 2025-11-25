import dbOperations from './db.js';

await dbOperations.init();
const issues = dbOperations.getAllIssues();

console.log('Total issues:', issues.length);
console.log('\nSample real newsletter issues:');

issues
  .filter(i => i.title && i.title.length > 20 && !i.title.includes('Comment'))
  .slice(0, 15)
  .forEach(i => {
    console.log(`  - ${i.date || 'no-date'} | ${i.title.substring(0, 50)}`);
    console.log(`    ${i.url}`);
  });

console.log('\nStats:');
console.log('  With dates:', issues.filter(i => i.date).length);
console.log('  Scraped:', issues.filter(i => i.scraped_at).length);
