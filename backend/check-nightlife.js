import pool from './src/db.js';

pool.query(
  `SELECT id, name, categories FROM attractions a
   WHERE a.city_id = (SELECT city_id FROM cities WHERE LOWER(name) = 'cairo')
   ORDER BY a.id`,
  (err, res) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log('Looking for nightlife/party/entertainment/cinema/gaming categories in Cairo:\n');
    let found = false;

    res.rows.forEach(row => {
      if (row.categories) {
        const catStr = JSON.stringify(row.categories).toLowerCase();
        if (catStr.includes('nightlife') || catStr.includes('party') || catStr.includes('entertainment') || catStr.includes('cinema') || catStr.includes('gaming') || catStr.includes('amusement')) {
          console.log(`ID: ${row.id}, Name: ${row.name}`);
          console.log(`  Categories: ${JSON.stringify(row.categories)}\n`);
          found = true;
        }
      }
    });

    if (!found) {
      console.log('No nightlife/entertainment attractions found in Cairo.');
    }

    process.exit();
  }
);
