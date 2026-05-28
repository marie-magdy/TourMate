import pool from './src/db.js';

pool.query(
  `SELECT id, name, categories FROM attractions a 
   WHERE a.city_id = (SELECT city_id FROM cities WHERE LOWER(name) = 'alexandria')
   ORDER BY a.id`,
  (err, res) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log('Looking for water/diving/beach/swim categories in Alexandria:\n');
    let found = false;

    res.rows.forEach(row => {
      if (row.categories) {
        const catStr = JSON.stringify(row.categories).toLowerCase();
        if (catStr.includes('water') || catStr.includes('dive') || catStr.includes('beach') || catStr.includes('swim') || catStr.includes('water sports') || catStr.includes('snorkel')) {
          console.log(`ID: ${row.id}, Name: ${row.name}`);
          console.log(`  Categories: ${JSON.stringify(row.categories)}\n`);
          found = true;
        }
      }
    });

    if (!found) {
      console.log('No water/diving/beach attractions found in Alexandria.');
      console.log('\nAll available categories in Alexandria:');
      const allCats = new Set();
      res.rows.forEach(row => {
        if (row.categories && Array.isArray(row.categories)) {
          row.categories.forEach(cat => allCats.add(cat));
        }
      });
      const sorted = Array.from(allCats).sort();
      sorted.forEach(cat => console.log(`  - ${cat}`));
    }

    process.exit();
  }
);
