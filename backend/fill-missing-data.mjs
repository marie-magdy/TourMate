/**
 * fill-missing-data.mjs
 *
 * Fills missing / short descriptions, images, and price_min/max for all attractions.
 *
 *  Descriptions  → Groq AI (llama-3.3-70b) — rich 4-5 sentence tourist descriptions
 *                   Generated for: null descriptions OR descriptions shorter than 150 chars
 *  Images        → Google Places API        — up to 3 photos per attraction
 *                   Generated for: attractions with no primary image
 *  Price min/max → Derived from existing admission_egp / price_from columns (no API needed)
 *                   Set for: attractions where price_min OR price_max is NULL
 *
 * USAGE:
 *   Dry run (default — prints what would happen, no DB writes):
 *     node --env-file=.env fill-missing-data.mjs
 *
 *   Live run (writes to DB):
 *     node --env-file=.env fill-missing-data.mjs --live
 *
 * REQUIRED in backend/.env:
 *   GOOGLE_PLACES_KEY=your_key_here
 *   GROQ_API_KEY=already_set
 */

import pool from './src/db.js';

const DRY_RUN        = !process.argv.includes('--live');
const REGEN_DESC     = process.argv.includes('--regen-desc');  // force regenerate ALL descriptions
const GOOGLE_KEY     = process.env.GOOGLE_PLACES_KEY;
const GROQ_KEY       = process.env.GROQ_API_KEY;
const PHOTOS_PER_PLACE      = 3;
const RATE_LIMIT_MS         = 1100;   // ~1 Google req/sec
const DESC_MIN_LENGTH       = 40;     // descriptions shorter than this get regenerated

// ── Helpers ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log   = (msg) => console.log(`[${DRY_RUN ? 'DRY' : 'LIVE'}] ${msg}`);

// ── Google Places: Text Search → place_id ─────────────────────────────
async function findPlaceId(name, city) {
  const query = encodeURIComponent(`${name} ${city} Egypt`);
  const url   = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_KEY}`;
  const res   = await fetch(url);
  const data  = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  return data.results[0].place_id;
}

// ── Google Places: Place Details → photo references ───────────────────
async function getPhotoRefs(placeId) {
  const url  = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK') return [];
  return (data.result?.photos ?? []).slice(0, PHOTOS_PER_PLACE);
}

// ── Google Places: build photo URL from photo_reference ──────────────
function buildPhotoUrl(photoReference) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${GOOGLE_KEY}`;
}

// ── Groq AI: generate a rich tourist description ──────────────────────
async function generateDescription(name, city, categories) {
  const catText = categories?.length ? categories.join(', ') : 'tourist attraction';
  const prompt  =
    `Write a short tourist description for "${name}" located in ${city}, Egypt. ` +
    `It is categorized as: ${catText}. ` +
    `Write exactly 2-3 sentences maximum. Be specific and punchy. ` +
    `Do not use bullet points, headers, or emojis. Plain text only.`;

  const res  = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  120,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

// ── Derive price_min / price_max from existing DB columns ─────────────
//   price_min = price_from  (the advertised starting price)
//   price_max = admission_egp if it's higher than price_from, otherwise price_from * 1.5
function derivePrices(priceFrom, admissionEgp) {
  const base = parseFloat(priceFrom ?? 0);
  const adm  = parseFloat(admissionEgp ?? 0);
  const min  = base;
  const max  = adm > base ? adm : Math.round(base * 1.5);
  return { min, max };
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  if (!GROQ_KEY) {
    console.error('ERROR: GROQ_API_KEY is not set in .env'); process.exit(1);
  }
  if (!GOOGLE_KEY) {
    console.error('ERROR: GOOGLE_PLACES_KEY is not set in .env'); process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(DRY_RUN
    ? '  DRY RUN — nothing will be written to the database'
    : '  LIVE RUN — changes WILL be written to the database');
  console.log('='.repeat(60));

  // ── Load all attractions ───────────────────────────────────────────
  const { rows: attractions } = await pool.query(`
    SELECT a.id, a.name, a.description, a.price_from, a.admission_egp,
           a.price_min, a.price_max,
           ci.name AS city,
           CASE
             WHEN COUNT(c.name) > 0
               THEN ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL)
             WHEN a.categories IS NOT NULL AND trim(a.categories) != ''
               THEN string_to_array(regexp_replace(trim(a.categories), '\\s*,\\s*', ',', 'g'), ',')
             ELSE ARRAY[]::text[]
           END AS categories
    FROM attractions a
    LEFT JOIN cities ci ON ci.city_id = a.city_id
    LEFT JOIN attraction_categories ac ON ac.attraction_id = a.id
    LEFT JOIN categories c ON c.category_id = ac.category_id
    GROUP BY a.id, ci.name
    ORDER BY a.id
  `);

  // ── Load image status per attraction ──────────────────────────────
  const { rows: imageRows } = await pool.query(`
    SELECT attraction_id, bool_or(is_primary) AS has_primary
    FROM attraction_images
    GROUP BY attraction_id
  `);
  const imageMap = {};
  for (const row of imageRows) imageMap[row.attraction_id] = row.has_primary;

  // ── Tally ──────────────────────────────────────────────────────────
  const needsDesc   = REGEN_DESC ? attractions : attractions.filter(a => !a.description?.trim() || a.description.length < DESC_MIN_LENGTH);
  const needsImages = attractions.filter(a => !imageMap[a.id]);
  const needsPrices = attractions.filter(a => a.price_min == null || a.price_max == null);

  console.log(`\nTotal attractions      : ${attractions.length}`);
  console.log(`Need description       : ${needsDesc.length}  (null or < ${DESC_MIN_LENGTH} chars)`);
  console.log(`Need images            : ${needsImages.length} (no primary image)`);
  console.log(`Need price_min/max     : ${needsPrices.length}`);
  console.log('');

  let updatedDesc = 0, updatedImages = 0, updatedPrices = 0;
  let failedDesc  = 0, failedImages  = 0;
  let googleCalls = 0, groqCalls     = 0;

  for (const attraction of attractions) {
    const missingDesc   = REGEN_DESC || !attraction.description?.trim() || attraction.description.length < DESC_MIN_LENGTH;
    const missingImages = !imageMap[attraction.id];
    const missingPrices = attraction.price_min == null || attraction.price_max == null;

    if (!missingDesc && !missingImages && !missingPrices) continue;

    const needs = [
      missingDesc   && 'description',
      missingImages && 'images',
      missingPrices && 'prices',
    ].filter(Boolean).join(', ');

    log(`\n[${attraction.id}] "${attraction.name}" (${attraction.city}) — needs: ${needs}`);

    // ── Prices (no API — derived from existing columns) ───────────
    if (missingPrices) {
      const { min, max } = derivePrices(attraction.price_from, attraction.admission_egp);
      log(`  prices: price_from=${attraction.price_from} admission_egp=${attraction.admission_egp} → price_min=${min}, price_max=${max} EGP`);
      if (!DRY_RUN) {
        await pool.query(
          `UPDATE attractions SET price_min = $1, price_max = $2, updated_at = NOW() WHERE id = $3`,
          [min, max, attraction.id]
        );
      }
      updatedPrices++;
    }

    // ── Description (Groq AI) ──────────────────────────────────────
    if (missingDesc) {
      try {
        groqCalls++;
        const desc = await generateDescription(attraction.name, attraction.city, attraction.categories);
        if (desc) {
          log(`  description (${desc.length} chars): "${desc.slice(0, 100)}..."`);
          if (!DRY_RUN) {
            await pool.query(
              `UPDATE attractions SET description = $1, updated_at = NOW() WHERE id = $2`,
              [desc, attraction.id]
            );
          }
          updatedDesc++;
        } else {
          log(`  description: Groq returned empty response`);
          failedDesc++;
        }
      } catch (err) {
        log(`  description: Groq error — ${err.message}`);
        failedDesc++;
      }
      await sleep(200); // small pause between Groq calls
    }

    // ── Images (Google Places) ─────────────────────────────────────
    if (missingImages) {
      try {
        await sleep(RATE_LIMIT_MS);
        googleCalls++;
        const placeId = await findPlaceId(attraction.name, attraction.city);

        if (!placeId) {
          log(`  images: not found on Google Places`);
          failedImages++;
          continue;
        }

        await sleep(RATE_LIMIT_MS);
        googleCalls++;
        const photoRefs = await getPhotoRefs(placeId);

        if (!photoRefs.length) {
          log(`  images: no photos on Google Places`);
          failedImages++;
          continue;
        }

        for (let i = 0; i < photoRefs.length; i++) {
          const imageUrl  = buildPhotoUrl(photoRefs[i].photo_reference);
          const isPrimary = i === 0;
          log(`  image[${i + 1}]: ${isPrimary ? '(primary) ' : ''}${imageUrl.slice(0, 90)}...`);
          if (!DRY_RUN) {
            await pool.query(
              `INSERT INTO attraction_images (attraction_id, image_url, is_primary) VALUES ($1, $2, $3)`,
              [attraction.id, imageUrl, isPrimary]
            );
          }
        }
        updatedImages++;
      } catch (err) {
        log(`  images: error — ${err.message}`);
        failedImages++;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────
  const estimatedGoogleCost = ((googleCalls / 1000) * 25).toFixed(2);
  const groqCost            = 'free';

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Descriptions updated  : ${updatedDesc}  (failed: ${failedDesc})`);
  console.log(`Images updated        : ${updatedImages}  (failed: ${failedImages})`);
  console.log(`Prices updated        : ${updatedPrices}`);
  console.log(`Google API calls      : ${googleCalls}  (~$${estimatedGoogleCost})`);
  console.log(`Groq API calls        : ${groqCalls}   (${groqCost})`);
  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Run with --live to apply changes.');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
