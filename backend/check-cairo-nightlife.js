import pool from './src/db.js';

// Check which attractions in Cairo have ANY of the nightlife-related categories
pool.query(
  `SELECT a.id, a.name,
          ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as join_table_categories,
          a.categories as text_categories
   FROM attractions a
   LEFT JOIN attraction_categories ac ON ac.attraction_id = a.id
   LEFT JOIN categories c ON c.category_id = ac.category_id
   WHERE a.city_id = (SELECT city_id FROM cities WHERE LOWER(name) = 'cairo')
     AND (
       LOWER(a.categories) ILIKE '%nightlife%'
       OR LOWER(a.categories) ILIKE '%party%'
       OR LOWER(a.categories) ILIKE '%entertainment%'
       OR LOWER(a.categories) ILIKE '%amusement%'
       OR LOWER(a.categories) ILIKE '%cinema%'
       OR LOWER(a.categories) ILIKE '%gaming%'
       OR c.name IN ('nightlife', 'party', 'entertainment', 'amusement', 'cinema', 'gaming')
     )
   GROUP BY a.id, a.name, a.categories
   ORDER BY a.id`,
  (err, res) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    console.log('Cairo attractions matching ANY nightlife-related category:\n');
    if (res.rows.length === 0) {
      console.log('NONE FOUND!');
      console.log('\nThis might be the issue - Cairo has no attractions tagged with nightlife-related categories.');
      console.log('\nMaybe you need to check if attractions should be re-categorized?');
    } else {
      res.rows.forEach(row => {
        console.log(`ID ${row.id}: ${row.name}`);
        const joinCats = row.join_table_categories && row.join_table_categories.length > 0 
          ? row.join_table_categories.join(', ') 
          : '(none)';
        const textCats = row.text_categories || '(none)';
        console.log(`  Join table: ${joinCats}`);
        console.log(`  Text field: ${textCats}\n`);
      });
    }
    process.exit();
  }
);
