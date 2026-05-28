import pool from './src/db.js';

pool.query(
  `SELECT id, name, categories FROM attractions a
   ORDER BY a.id`,
  (err, res) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log('All unique categories in database:\n');
    const allCats = new Set();
    res.rows.forEach(row => {
      if (row.categories) {
        if (Array.isArray(row.categories)) {
          row.categories.forEach(cat => allCats.add(cat));
        } else if (typeof row.categories === 'string') {
          row.categories.split(',').forEach(cat => allCats.add(cat.trim()));
        }
      }
    });
    
    const sorted = Array.from(allCats).sort();
    sorted.forEach(cat => console.log(`  - ${cat}`));
    
    console.log(`\nTotal unique categories: ${sorted.length}`);
    process.exit();
  }
);
