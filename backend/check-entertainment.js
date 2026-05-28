import pool from './src/db.js';

pool.query(
  `SELECT a.id, a.name, a.city_id, 
          ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as join_categories,
          a.categories as text_categories
   FROM attractions a
   LEFT JOIN attraction_categories ac ON ac.attraction_id = a.id
   LEFT JOIN categories c ON c.category_id = ac.category_id
   WHERE a.name ILIKE '%cafe%' OR a.name ILIKE '%bar%' OR a.name ILIKE '%lounge%' 
      OR a.name ILIKE '%club%' OR a.name ILIKE '%nightclub%' OR a.name ILIKE '%cinema%'
      OR a.name ILIKE '%amusement%' OR a.name ILIKE '%park%' OR a.name ILIKE '%arcade%'
   GROUP BY a.id, a.name, a.city_id, a.categories
   ORDER BY a.id`,
  (err, res) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log('Entertainment-related attractions across database:\n');
    const allRows = {};
    
    res.rows.forEach(row => {
      const cityId = row.city_id;
      if (!allRows[cityId]) allRows[cityId] = [];
      allRows[cityId].push({
        id: row.id,
        name: row.name,
        joinCats: row.join_categories ? row.join_categories.join(', ') : '(none)',
        textCats: row.text_categories ? row.text_categories.split(',').map(c => c.trim()).join(', ') : '(none)'
      });
    });

    // Get city names
    pool.query(`SELECT city_id, name FROM cities ORDER BY city_id`, (err2, res2) => {
      if (err2) {
        console.error('Error2:', err2);
        process.exit(1);
      }

      const cityMap = {};
      res2.rows.forEach(row => {
        cityMap[row.city_id] = row.name;
      });

      Object.keys(allRows).forEach(cityId => {
        const cityName = cityMap[cityId] || 'Unknown';
        console.log(`\n${cityName}:`);
        allRows[cityId].forEach(att => {
          console.log(`  ID ${att.id}: ${att.name}`);
          console.log(`    Join table: ${att.joinCats}`);
          console.log(`    Text field: ${att.textCats}`);
        });
      });

      process.exit();
    });
  }
);
