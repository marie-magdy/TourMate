import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mapping of image folder names to attraction IDs
 */
const imageFolderToAttraction = {
  'cairo_giza_great_pyramids': 'ATT001',           // Great Pyramid of Giza
  'cairo_grand_egyptian_museum': 'ATT002',          // Egyptian Museum
  'cairo_salah_eldin_citadel': 'ATT005',            // Citadel of Saladin
  'cairo_hanging_church': 'ATT007',                 // Coptic Cairo
  'cairo_babylon_fortress': 'ATT007',               // Also Coptic Cairo
  'cairo_amr_ibn_al_aas_mosque': 'ATT007',          // Also Coptic Cairo
  'cairo_mohamed_ali_mosque': 'ATT064',             // Muhammad Ali Mosque
  'alexandria_qaitbay_citadel': 'ATT017',           // Qaitbay Citadel
  'alexandria_montaza_palace': 'ATT018',            // Montaza Palace
  'alexandria_opera_house': 'ATT032',               // Opera House
  'alexandria_bibliotheca_alexandrina': 'ATT050',   // Bibliotheca Alexandrina
  'alexandria_stanley_bridge': 'ATT049'             // Alexandria Corniche area
};

/**
 * Fix image paths to point to actual image files in uploads folder
 */
async function fixImagePaths() {
  try {
    console.log('Starting image path correction...');
    
    const uploadsPath = path.join(__dirname, '../uploads');
    
    // Clear existing incorrect image records
    await pool.query('DELETE FROM attraction_images;');
    console.log('✓ Cleared existing image records');
    
    // Scan all image folders and create correct records
    let totalImagesInserted = 0;
    
    for (const [folderName, attractionId] of Object.entries(imageFolderToAttraction)) {
      const folderPath = path.join(uploadsPath, folderName);
      
      if (!fs.existsSync(folderPath)) {
        console.log(`⚠ Folder not found: ${folderName}`);
        continue;
      }
      
      // Get all image files in this folder
      const files = fs.readdirSync(folderPath).filter(file => {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
      });
      
      if (files.length === 0) {
        console.log(`⚠ No images found in ${folderName}`);
        continue;
      }
      
      // Insert image records for this attraction
      const insertImageQuery = `
        INSERT INTO attraction_images (attraction_id, image_url, filename)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING;
      `;
      
      for (const file of files) {
        const imageUrl = `http://localhost:3000/uploads/${folderName}/${file}`;
        const filename = `${folderName}/${file}`;
        
        await pool.query(insertImageQuery, [
          attractionId,
          imageUrl,
          filename
        ]);
        
        totalImagesInserted++;
      }
      
      console.log(`✓ Added ${files.length} images for ${attractionId} (folder: ${folderName})`);
    }
    
    // Verify the results
    const result = await pool.query(
      'SELECT attraction_id, COUNT(*) as image_count FROM attraction_images GROUP BY attraction_id ORDER BY attraction_id;'
    );
    
    console.log('\n✓ Image count per attraction:');
    result.rows.forEach(row => {
      console.log(`  ${row.attraction_id}: ${row.image_count} images`);
    });
    
    const totalResult = await pool.query('SELECT COUNT(*) FROM attraction_images;');
    console.log(`\n✓ Total images in database: ${totalResult.rows[0].count}`);
    console.log('✓ Image path correction completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing image paths:', error);
    process.exit(1);
  }
}

fixImagePaths();
