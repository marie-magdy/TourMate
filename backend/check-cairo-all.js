import pool from './src/db.js';

pool.query(
  `SELECT DISTINCT a.id, a.name, a.categories as text_categories, 
          ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as join_table_categories
   FROM attractions a
   LEFT JOIN attraction_categories ac ON ac.attraction_id = a.id
   LEFT JOIN categories c ON c.category_id = ac.category_id
   WHERE a.city_id = (SELECT city_id FROM cities WHERE LOWER(name) = 'cairo')
   GROUP BY a.id, a.name, a.categories
   ORDER BY a.id`,
  (err, res) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log('All attractions in Cairo with their categories:\n');
    console.log('ID | Name | Text Field | Join Table Categories\n');
    
    res.rows.forEach(row => {
      const textCats = row.text_categories ? row.text_categories.split(',').join('; ') : '(empty)';
      const joinCats = row.join_table_categories && row.join_table_categories.length > 0 ? row.join_table_categories.join('; ') : '(empty)';
      console.log(`${row.id} | ${row.name} | ${textCats} | ${joinCats}`);
    });
    
    console.log(`\n\nTotal attractions in Cairo: ${res.rows.length}`);
    process.exit();
  }
);
