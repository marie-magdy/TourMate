import pool from './db.js';
import runMigrations from './createImageTable.js';

const usersData = [
  {
    user_id: 'USR001',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'English',
    current_city: 'Cairo',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 45,
    sustainability_level: 'Silver'
  },
  {
    user_id: 'USR002',
    name: 'Ahmed Hassan',
    email: 'ahmed.hassan@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'Arabic',
    current_city: 'Cairo',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 120,
    sustainability_level: 'Gold'
  },
  {
    user_id: 'USR003',
    name: 'Marie Dupont',
    email: 'marie.dupont@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'French',
    current_city: 'Alexandria',
    accessibility_needs: 'Wheelchair',
    is_admin: false,
    eco_points: 20,
    sustainability_level: 'Bronze'
  },
  {
    user_id: 'USR004',
    name: 'Youssef Khaldi',
    email: 'youssef.khaldi@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'Arabic',
    current_city: 'Cairo',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 80,
    sustainability_level: 'Silver'
  },
  {
    user_id: 'USR005',
    name: 'Emma Johnson',
    email: 'emma.johnson@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'English',
    current_city: 'Alexandria',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 75,
    sustainability_level: 'Silver'
  },
  {
    user_id: 'USR006',
    name: 'Fatima Al-Rashid',
    email: 'fatima.rashid@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'Arabic',
    current_city: 'Cairo',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 60,
    sustainability_level: 'Silver'
  },
  {
    user_id: 'USR007',
    name: 'Omar Tarek',
    email: 'omar.tarek@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'Arabic',
    current_city: 'Alexandria',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 90,
    sustainability_level: 'Gold'
  },
  {
    user_id: 'USR008',
    name: 'Nour Ibrahim',
    email: 'nour.ibrahim@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'Arabic',
    current_city: 'Cairo',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 150,
    sustainability_level: 'Gold'
  },
  {
    user_id: 'USR009',
    name: 'James Wilson',
    email: 'james.wilson@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'English',
    current_city: 'Cairo',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 30,
    sustainability_level: 'Bronze'
  },
  {
    user_id: 'USR010',
    name: 'Layla Mahmoud',
    email: 'layla.mahmoud@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'Arabic',
    current_city: 'Alexandria',
    accessibility_needs: 'None',
    is_admin: false,
    eco_points: 110,
    sustainability_level: 'Gold'
  }
];

const citiesData = [
  { city_id: 'CIT001', city_name: 'Cairo', country: 'Egypt' },
  { city_id: 'CIT002', city_name: 'Alexandria', country: 'Egypt' },
  { city_id: 'CIT003', city_name: 'Giza', country: 'Egypt' },
  { city_id: 'CIT004', city_name: 'Aswan', country: 'Egypt' },
  { city_id: 'CIT005', city_name: 'Luxor', country: 'Egypt' },
  { city_id: 'CIT006', city_name: 'South Sinai', country: 'Egypt' },
  { city_id: 'CIT007', city_name: 'Red Sea', country: 'Egypt' },
  { city_id: 'CIT008', city_name: 'Ismailia', country: 'Egypt' },
  { city_id: 'CIT009', city_name: 'Fayoum', country: 'Egypt' },
  { city_id: 'CIT010', city_name: 'New Valley', country: 'Egypt' },
  { city_id: 'CIT011', city_name: 'North Coast', country: 'Egypt' },
  { city_id: 'CIT012', city_name: 'Matrouh', country: 'Egypt' },
  { city_id: 'CIT013', city_name: 'Abu Simbel', country: 'Egypt' }
];

const categoriesData = [
  { category_id: 'CAT001', category_name: 'historical' },
  { category_id: 'CAT002', category_name: 'ancient' },
  { category_id: 'CAT003', category_name: 'museum' },
  { category_id: 'CAT004', category_name: 'religious' },
  { category_id: 'CAT005', category_name: 'cultural' },
  { category_id: 'CAT006', category_name: 'shopping' },
  { category_id: 'CAT007', category_name: 'beach' },
  { category_id: 'CAT008', category_name: 'coastal' },
  { category_id: 'CAT009', category_name: 'outdoor' },
  { category_id: 'CAT010', category_name: 'restaurant' },
  { category_id: 'CAT011', category_name: 'cafe' },
  { category_id: 'CAT012', category_name: 'park' },
  { category_id: 'CAT013', category_name: 'family' },
  { category_id: 'CAT014', category_name: 'entertainment' },
  { category_id: 'CAT015', category_name: 'temple' },
  { category_id: 'CAT016', category_name: 'fortress' },
  { category_id: 'CAT017', category_name: 'monument' },
  { category_id: 'CAT018', category_name: 'modern' },
  { category_id: 'CAT019', category_name: 'nature' },
  { category_id: 'CAT020', category_name: 'botanical' }
];

const userLikedAttractionsData = [
  { user_id: 'USR001', attraction_id: 'ATT001' },
  { user_id: 'USR001', attraction_id: 'ATT002' },
  { user_id: 'USR002', attraction_id: 'ATT033' },
  { user_id: 'USR002', attraction_id: 'ATT041' },
  { user_id: 'USR003', attraction_id: 'ATT050' },
  { user_id: 'USR003', attraction_id: 'ATT077' },
  { user_id: 'USR004', attraction_id: 'ATT013' },
  { user_id: 'USR004', attraction_id: 'ATT039' },
  { user_id: 'USR005', attraction_id: 'ATT082' },
  { user_id: 'USR005', attraction_id: 'ATT071' },
  { user_id: 'USR006', attraction_id: 'ATT005' },
  { user_id: 'USR006', attraction_id: 'ATT007' },
  { user_id: 'USR007', attraction_id: 'ATT049' },
  { user_id: 'USR007', attraction_id: 'ATT077' },
  { user_id: 'USR008', attraction_id: 'ATT002' },
  { user_id: 'USR008', attraction_id: 'ATT041' },
  { user_id: 'USR009', attraction_id: 'ATT001' },
  { user_id: 'USR009', attraction_id: 'ATT034' },
  { user_id: 'USR010', attraction_id: 'ATT082' },
  { user_id: 'USR010', attraction_id: 'ATT078' }
];

const attractionsToCityMap = {
  'Cairo': 'CIT001',
  'Alexandria': 'CIT002',
  'Giza': 'CIT003',
  'Aswan': 'CIT004',
  'Luxor': 'CIT005',
  'South Sinai': 'CIT006',
  'Red Sea': 'CIT007',
  'Ismailia': 'CIT008',
  'Fayoum': 'CIT009',
  'New Valley': 'CIT010',
  'North Coast': 'CIT011',
  'Matrouh': 'CIT012',
  'Abu Simbel': 'CIT013'
};

const attractionCategoriesMap = {
  'ATT001': ['CAT001', 'CAT002'],
  'ATT002': ['CAT003', 'CAT005'],
  'ATT003': ['CAT006', 'CAT005'],
  'ATT004': ['CAT004', 'CAT002', 'CAT005'],
  'ATT005': ['CAT001', 'CAT002', 'CAT005'],
  'ATT006': ['CAT003', 'CAT005'],
  'ATT007': ['CAT004', 'CAT001', 'CAT005'],
  'ATT008': ['CAT009', 'CAT013'],
  'ATT009': ['CAT003', 'CAT005', 'CAT001'],
  'ATT010': ['CAT007', 'CAT009', 'CAT010'],
  'ATT011': ['CAT004', 'CAT002', 'CAT005'],
  'ATT012': ['CAT004', 'CAT005'],
  'ATT013': ['CAT001', 'CAT005', 'CAT006'],
  'ATT014': ['CAT001', 'CAT002', 'CAT008'],
  'ATT015': ['CAT001', 'CAT002'],
  'ATT016': ['CAT003', 'CAT005', 'CAT001'],
  'ATT017': ['CAT001', 'CAT002', 'CAT016'],
  'ATT018': ['CAT001', 'CAT012', 'CAT008'],
  'ATT019': ['CAT001', 'CAT002', 'CAT016'],
  'ATT020': ['CAT001', 'CAT002', 'CAT003'],
  'ATT021': ['CAT001', 'CAT002', 'CAT003'],
  'ATT022': ['CAT013', 'CAT009'],
  'ATT023': ['CAT003', 'CAT001', 'CAT005'],
  'ATT024': ['CAT003', 'CAT001', 'CAT005'],
  'ATT025': ['CAT003', 'CAT001', 'CAT005'],
  'ATT026': ['CAT003', 'CAT005', 'CAT001'],
  'ATT027': ['CAT003', 'CAT005'],
  'ATT028': ['CAT003', 'CAT001', 'CAT005'],
  'ATT029': ['CAT009', 'CAT017'],
  'ATT030': ['CAT009', 'CAT012'],
  'ATT031': ['CAT009', 'CAT013', 'CAT012'],
  'ATT032': ['CAT005', 'CAT014'],
  'ATT033': ['CAT011', 'CAT010', 'CAT005'],
  'ATT034': ['CAT001', 'CAT002'],
  'ATT035': ['CAT001', 'CAT002'],
  'ATT036': ['CAT001', 'CAT002'],
  'ATT037': ['CAT003', 'CAT001', 'CAT002'],
  'ATT038': ['CAT001', 'CAT002', 'CAT015'],
  'ATT039': ['CAT001', 'CAT002', 'CAT015'],
  'ATT040': ['CAT001', 'CAT002', 'CAT015'],
  'ATT041': ['CAT001', 'CAT002'],
  'ATT042': ['CAT001', 'CAT002', 'CAT015'],
  'ATT043': ['CAT001', 'CAT002', 'CAT017'],
  'ATT044': ['CAT001', 'CAT018', 'CAT009'],
  'ATT045': ['CAT001', 'CAT002', 'CAT015'],
  'ATT046': ['CAT003', 'CAT005', 'CAT001'],
  'ATT047': ['CAT001', 'CAT002', 'CAT015'],
  'ATT048': ['CAT001', 'CAT006', 'CAT005'],
  'ATT049': ['CAT007', 'CAT008', 'CAT009', 'CAT010'],
  'ATT050': ['CAT005', 'CAT003', 'CAT018'],
  'ATT051': ['CAT011', 'CAT010', 'CAT005'],
  'ATT052': ['CAT003', 'CAT005', 'CAT001'],
  'ATT053': ['CAT003', 'CAT005', 'CAT001'],
  'ATT054': ['CAT003', 'CAT005'],
  'ATT055': ['CAT009', 'CAT012', 'CAT019'],
  'ATT056': ['CAT009', 'CAT012'],
  'ATT057': ['CAT009', 'CAT012'],
  'ATT058': ['CAT009', 'CAT012'],
  'ATT059': ['CAT001', 'CAT005', 'CAT003'],
  'ATT060': ['CAT001', 'CAT004', 'CAT005'],
  'ATT061': ['CAT001', 'CAT005'],
  'ATT062': ['CAT001', 'CAT002'],
  'ATT063': ['CAT004', 'CAT001', 'CAT005'],
  'ATT064': ['CAT004', 'CAT001', 'CAT005'],
  'ATT065': ['CAT003', 'CAT001', 'CAT005'],
  'ATT066': ['CAT003', 'CAT001'],
  'ATT067': ['CAT003', 'CAT001', 'CAT005'],
  'ATT068': ['CAT001', 'CAT018', 'CAT009'],
  'ATT069': ['CAT009', 'CAT019'],
  'ATT070': ['CAT007', 'CAT009', 'CAT010'],
  'ATT071': ['CAT007', 'CAT008', 'CAT009', 'CAT010'],
  'ATT072': ['CAT007', 'CAT009', 'CAT019'],
  'ATT073': ['CAT007', 'CAT008', 'CAT009'],
  'ATT074': ['CAT007', 'CAT008', 'CAT009', 'CAT010'],
  'ATT075': ['CAT007', 'CAT008', 'CAT009'],
  'ATT076': ['CAT007', 'CAT008', 'CAT009'],
  'ATT077': ['CAT007', 'CAT008', 'CAT009'],
  'ATT078': ['CAT007', 'CAT008', 'CAT009', 'CAT010'],
  'ATT079': ['CAT001', 'CAT005'],
  'ATT080': ['CAT007', 'CAT009', 'CAT019'],
  'ATT081': ['CAT009', 'CAT019'],
  'ATT082': ['CAT009', 'CAT019'],
  'ATT083': ['CAT009', 'CAT019', 'CAT005'],
  'ATT084': ['CAT007', 'CAT009', 'CAT008', 'CAT019'],
  'ATT085': ['CAT007', 'CAT009', 'CAT008', 'CAT019'],
  'ATT086': ['CAT007', 'CAT009', 'CAT008', 'CAT019', 'CAT001'],
  'ATT087': ['CAT007', 'CAT008', 'CAT012', 'CAT019']
};

const attractionsData = [
  { attraction_id: 'ATT001', name: 'Great Pyramid of Giza', city_id: 'CIT003', district: 'Giza', latitude: 29.9792, longitude: 31.1342, address: 'Giza Plateau', sub_type: 'Monument', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 300, avg_rating: 4.8, total_reviews: 5000, open_hour: 8, close_hour: 17, meal_slot: 'lunch,dinner', price_range: 'Premium|200-500', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'The great pyramid of Giza, one of the most iconic monuments in the world', image: 'https://example.com/pyramid.jpg' },
  { attraction_id: 'ATT002', name: 'Egyptian Museum', city_id: 'CIT001', district: 'Downtown', latitude: 30.0361, longitude: 31.2365, address: 'Tahrir Square', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 4, admission_egp: 120, avg_rating: 4.6, total_reviews: 4500, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Egyptian Museum - Home to the worlds largest collection of ancient Egyptian artifacts', image: 'https://example.com/egyptian-museum.jpg' },
  { attraction_id: 'ATT003', name: 'Khan el-Khalili Bazaar', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0609, longitude: 31.2535, address: 'Al-Gamaliya Street', sub_type: 'Market', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.4, total_reviews: 3800, open_hour: 10, close_hour: 22, meal_slot: 'breakfast,lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Historic bazaar with traditional Egyptian, handicrafts and souvenirs', image: 'https://example.com/khan-khalili.jpg' },
  { attraction_id: 'ATT004', name: 'Al-Azhar Mosque', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0634, longitude: 31.2629, address: 'Al-Azhar Street', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 10, avg_rating: 4.5, total_reviews: 2200, open_hour: 8, close_hour: 20, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Ancient mosque of Al-Azhar', image: 'https://example.com/al-azhar.jpg' },
  { attraction_id: 'ATT005', name: 'Citadel of Saladin', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0281, longitude: 31.2629, address: 'Al-Qala Street', sub_type: 'Fortress', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 80, avg_rating: 4.5, total_reviews: 3200, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Citadel of Saladin fortress', image: 'https://example.com/citadel.jpg' },
  { attraction_id: 'ATT006', name: 'Islamic Art Museum', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0434, longitude: 31.2532, address: 'Bab al-Khalq', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 100, avg_rating: 4.4, total_reviews: 1800, open_hour: 9, close_hour: 16, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Museum of Islamic art', image: 'https://example.com/islamic-art.jpg' },
  { attraction_id: 'ATT007', name: 'Coptic Cairo', city_id: 'CIT001', district: 'Old Cairo', latitude: 30.0048, longitude: 31.2371, address: 'Mari Girgis Street', sub_type: 'Historic District', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 50, avg_rating: 4.3, total_reviews: 2100, open_hour: 9, close_hour: 17, meal_slot: 'lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Historic Coptic Cairo district', image: 'https://example.com/coptic-cairo.jpg' },
  { attraction_id: 'ATT008', name: 'Giza Zoo', city_id: 'CIT003', district: 'Giza', latitude: 30.0147, longitude: 31.1882, address: 'Omar Ibn Al-Khattab Street', sub_type: 'Zoo', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 40, avg_rating: 3.8, total_reviews: 1500, open_hour: 9, close_hour: 17, meal_slot: 'lunch,snack', price_range: 'Economy|30-100', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Giza Zoo', image: 'https://example.com/giza-zoo.jpg' },
  { attraction_id: 'ATT009', name: 'National Museum of Egyptian Civilization', city_id: 'CIT001', district: 'Fustat', latitude: 30.0003, longitude: 31.2437, address: 'Al-Cornish', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 4.5, total_reviews: 1200, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-250', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'National Museum of Egyptian Civilization', image: 'https://example.com/egyptian-civilization.jpg' },
  { attraction_id: 'ATT010', name: 'Nile River Cruise', city_id: 'CIT001', district: 'Downtown', latitude: 30.0467, longitude: 31.2358, address: 'Nile Corniche', sub_type: 'Activity', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 150, avg_rating: 4.2, total_reviews: 2800, open_hour: 18, close_hour: 23, meal_slot: 'dinner', price_range: 'Premium|100-400', crowd_label: 'Medium-High', crowd_pattern: 'weekend', description: 'Nile River Cruise', image: 'https://example.com/nile-cruise.jpg' },
  { attraction_id: 'ATT011', name: 'Al-Hakim Mosque', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0651, longitude: 31.2476, address: 'Khan al-Khalili', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 15, avg_rating: 4.3, total_reviews: 1400, open_hour: 8, close_hour: 19, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Al-Hakim Mosque', image: 'https://example.com/al-hakim.jpg' },
  { attraction_id: 'ATT012', name: 'Sayyida Zainab Mosque', city_id: 'CIT001', district: 'Old Cairo', latitude: 30.0174, longitude: 31.2381, address: 'Sayyida Zainab Square', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 10, avg_rating: 4.2, total_reviews: 1100, open_hour: 8, close_hour: 19, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Sayyida Zainab Mosque', image: 'https://example.com/sayyida-zainab.jpg' },
  { attraction_id: 'ATT013', name: 'Al-Muizz Street', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0616, longitude: 31.2503, address: 'Al-Muizz Li-Din Allah Street', sub_type: 'Historic Street', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.4, total_reviews: 2900, open_hour: 10, close_hour: 22, meal_slot: 'breakfast,lunch,dinner', price_range: 'Economy|30-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Historic Al-Muizz Street', image: 'https://example.com/al-muizz.jpg' },
  { attraction_id: 'ATT014', name: 'Manara of Alexandria', city_id: 'CIT002', district: 'Qaitbay', latitude: 31.2618, longitude: 29.8830, address: 'Corniche', sub_type: 'Lighthouse', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 80, avg_rating: 4.5, total_reviews: 4200, open_hour: 9, close_hour: 18, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Lighthouse of Alexandria', image: 'https://example.com/manara.jpg' },
  { attraction_id: 'ATT015', name: 'Pompey\'s Pillar', city_id: 'CIT002', district: 'Karnak', latitude: 31.2107, longitude: 29.9123, address: 'Karnak Area', sub_type: 'Monument', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.2, total_reviews: 1600, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Historical monument', image: 'https://example.com/pompey-pillar.jpg' },
  { attraction_id: 'ATT016', name: 'Alexandria National Museum', city_id: 'CIT002', district: 'Downtown', latitude: 31.2956, longitude: 29.9653, address: 'El Horreya Avenue', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 150, avg_rating: 4.3, total_reviews: 1800, open_hour: 10, close_hour: 16, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Museum in Alexandria', image: 'https://example.com/alexandria-museum.jpg' },
  { attraction_id: 'ATT017', name: 'Qaitbay Citadel', city_id: 'CIT002', district: 'Qaitbay', latitude: 31.2618, longitude: 29.8833, address: 'Corniche', sub_type: 'Fortress', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.4, total_reviews: 2400, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Ancient fortress on the coast', image: 'https://example.com/qaitbay.jpg' },
  { attraction_id: 'ATT018', name: 'Montaza Palace', city_id: 'CIT002', district: 'Montaza', latitude: 31.3158, longitude: 29.9890, address: 'Montaza Gardens', sub_type: 'Palace', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 80, avg_rating: 4.5, total_reviews: 3300, open_hour: 8, close_hour: 19, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Palace with beautiful gardens', image: 'https://example.com/montaza.jpg' },
  { attraction_id: 'ATT019', name: 'Alexandria Citadel', city_id: 'CIT002', district: 'Downtown', latitude: 31.2950, longitude: 29.9658, address: 'Downtown Area', sub_type: 'Fortress', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 60, avg_rating: 4.2, total_reviews: 1500, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Ancient citadel', image: 'https://example.com/alexandria-citadel.jpg' },
  { attraction_id: 'ATT020', name: 'Serapeum of Alexandria', city_id: 'CIT002', district: 'Karnak', latitude: 31.2107, longitude: 29.9120, address: 'Karnak Area', sub_type: 'Archaeological Site', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 50, avg_rating: 4.1, total_reviews: 1200, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Ancient Serapeum site', image: 'https://example.com/serapeum.jpg' },
  { attraction_id: 'ATT021', name: 'Catacombs of Kom el Shoqafa', city_id: 'CIT002', district: 'Karnak', latitude: 31.2080, longitude: 29.9130, address: 'Karnak Area', sub_type: 'Archaeological Site', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.3, total_reviews: 1700, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Ancient catacombs', image: 'https://example.com/catacombs.jpg' },
  { attraction_id: 'ATT022', name: 'Alexandria Aquarium', city_id: 'CIT002', district: 'Qaitbay', latitude: 31.2620, longitude: 29.8835, address: 'Corniche', sub_type: 'Aquarium', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 70, avg_rating: 3.8, total_reviews: 1600, open_hour: 10, close_hour: 18, meal_slot: 'snack,lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Aquarium in Alexandria', image: 'https://example.com/aquarium.jpg' },
  { attraction_id: 'ATT023', name: 'Abdeen Palace Museum', city_id: 'CIT001', district: 'Downtown', latitude: 30.0283, longitude: 31.2506, address: 'Abdeen Square', sub_type: 'Palace Museum', is_outdoor: 0, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.3, total_reviews: 1600, open_hour: 9, close_hour: 15, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Palace museum', image: 'https://example.com/abdeen.jpg' },
  { attraction_id: 'ATT024', name: 'Manial Palace Museum', city_id: 'CIT001', district: 'Manial', latitude: 30.0157, longitude: 31.2422, address: 'Manial Island', sub_type: 'Palace Museum', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 80, avg_rating: 4.4, total_reviews: 1500, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Palace museum on Manial Island', image: 'https://example.com/manial.jpg' },
  { attraction_id: 'ATT025', name: 'Gayer-Anderson Museum', city_id: 'CIT001', district: 'Old Cairo', latitude: 30.0054, longitude: 31.2378, address: 'Khan Misr Tulun', sub_type: 'House Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.3, total_reviews: 1200, open_hour: 10, close_hour: 16, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'House museum', image: 'https://example.com/gayer-anderson.jpg' },
  { attraction_id: 'ATT026', name: 'Islamic Museum of Cairo', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0415, longitude: 31.2522, address: 'Bab al-Khalq', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 100, avg_rating: 4.4, total_reviews: 1800, open_hour: 9, close_hour: 16, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Islamic museum', image: 'https://example.com/islamic-museum.jpg' },
  { attraction_id: 'ATT027', name: 'Textile Museum', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0610, longitude: 31.2530, address: 'Khan el-Khalili', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.2, total_reviews: 1000, open_hour: 10, close_hour: 17, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Textile museum', image: 'https://example.com/textile-museum.jpg' },
  { attraction_id: 'ATT028', name: 'Pharaonic Village', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0268, longitude: 31.2326, address: 'Zamalek Island', sub_type: 'Theme Park', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 3.9, total_reviews: 1700, open_hour: 10, close_hour: 19, meal_slot: 'lunch,snack', price_range: 'Economy|100-300', crowd_label: 'Medium-High', crowd_pattern: 'weekend', description: 'Pharaonic village', image: 'https://example.com/pharaonic-village.jpg' },
  { attraction_id: 'ATT029', name: 'Cairo Tower', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0296, longitude: 31.2328, address: 'Zamalek Island', sub_type: 'Tower', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 120, avg_rating: 4.1, total_reviews: 2200, open_hour: 9, close_hour: 23, meal_slot: 'lunch,dinner,snack', price_range: 'Economy|100-200', crowd_label: 'Medium-High', crowd_pattern: 'weekday,weekend', description: 'Tall tower with views over Cairo', image: 'https://example.com/cairo-tower.jpg' },
  { attraction_id: 'ATT030', name: 'Gezira Island', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0300, longitude: 31.2350, address: 'Gezira', sub_type: 'Island', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.2, total_reviews: 1900, open_hour: 8, close_hour: 20, meal_slot: 'lunch,dinner,snack', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Island in the Nile', image: 'https://example.com/gezira.jpg' },
  { attraction_id: 'ATT031', name: 'Aquarium Grotto', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0290, longitude: 31.2330, address: 'Gezira Island', sub_type: 'Park Attraction', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 20, avg_rating: 3.7, total_reviews: 800, open_hour: 10, close_hour: 18, meal_slot: 'snack', price_range: 'Economy|20-100', crowd_label: 'Medium', crowd_pattern: 'weekend', description: 'Aquarium grotto in park', image: 'https://example.com/aquarium-grotto.jpg' },
  { attraction_id: 'ATT032', name: 'Opera House', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0298, longitude: 31.2335, address: 'Gezira Island', sub_type: 'Theater', is_outdoor: 0, avg_visit_hrs: 2, admission_egp: 150, avg_rating: 4.5, total_reviews: 1700, open_hour: 16, close_hour: 23, meal_slot: 'dinner,snack', price_range: 'Premium|100-300', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Opera house theater', image: 'https://example.com/opera-house.jpg' },
  { attraction_id: 'ATT033', name: 'Downtown Cafe District', city_id: 'CIT001', district: 'Downtown', latitude: 30.0400, longitude: 31.2400, address: 'Downtown Cairo', sub_type: 'District', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.3, total_reviews: 2100, open_hour: 10, close_hour: 23, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Cafes and restaurants district', image: 'https://example.com/downtown-cafe.jpg' },
  { attraction_id: 'ATT034', name: 'Saqqara Pyramid Complex', city_id: 'CIT003', district: 'Saqqara', latitude: 29.8752, longitude: 31.2197, address: 'Saqqara', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 150, avg_rating: 4.6, total_reviews: 3000, open_hour: 8, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Medium', crowd_pattern: 'weekday', description: 'Pyramid complex at Saqqara', image: 'https://example.com/saqqara.jpg' },
  { attraction_id: 'ATT035', name: 'Dahshur Pyramids', city_id: 'CIT003', district: 'Dahshur', latitude: 29.7939, longitude: 31.2089, address: 'Dahshur', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 120, avg_rating: 4.5, total_reviews: 1700, open_hour: 8, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Pyramids at Dahshur', image: 'https://example.com/dahshur.jpg' },
  { attraction_id: 'ATT036', name: 'Abusir Pyramids', city_id: 'CIT003', district: 'Abusir', latitude: 29.9072, longitude: 31.2038, address: 'Abusir', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.3, total_reviews: 1400, open_hour: 8, close_hour: 17, meal_slot: '', price_range: 'Economy|100-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Pyramids at Abusir', image: 'https://example.com/abusir.jpg' },
  { attraction_id: 'ATT037', name: 'Memphis Open Air Museum', city_id: 'CIT003', district: 'Mi Rahina', latitude: 29.8436, longitude: 31.2596, address: 'Mi Rahina', sub_type: 'Museum', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 100, avg_rating: 4.4, total_reviews: 1600, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Open air museum at Memphis', image: 'https://example.com/memphis.jpg' },
  { attraction_id: 'ATT038', name: 'Edfu Temple', city_id: 'CIT004', district: 'Edfu', latitude: 24.9724, longitude: 32.8812, address: 'Edfu', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 150, avg_rating: 4.7, total_reviews: 2500, open_hour: 9, close_hour: 18, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'High', crowd_pattern: 'weekday', description: 'Ancient temple at Edfu', image: 'https://example.com/edfu.jpg' },
  { attraction_id: 'ATT039', name: 'Karnak Temple Complex', city_id: 'CIT005', district: 'Karnak', latitude: 25.7174, longitude: 32.6560, address: 'Karnak', sub_type: 'Temple Complex', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 140, avg_rating: 4.8, total_reviews: 4800, open_hour: 8, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Massive temple complex', image: 'https://example.com/karnak.jpg' },
  { attraction_id: 'ATT040', name: 'Luxor Temple', city_id: 'CIT005', district: 'Downtown', latitude: 25.6970, longitude: 32.6390, address: 'Luxor', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.7, total_reviews: 4200, open_hour: 8, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Temple in Luxor', image: 'https://example.com/luxor-temple.jpg' },
  { attraction_id: 'ATT041', name: 'Valley of the Kings', city_id: 'CIT005', district: 'West Bank', latitude: 25.7404, longitude: 32.6048, address: 'West Bank', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 200, avg_rating: 4.8, total_reviews: 4500, open_hour: 8, close_hour: 17, meal_slot: 'lunch', price_range: 'Premium|200-300', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Valley of the Kings', image: 'https://example.com/valley-kings.jpg' },
  { attraction_id: 'ATT042', name: 'Mortuary Temple of Hatshepsut', city_id: 'CIT005', district: 'West Bank', latitude: 25.7391, longitude: 32.6083, address: 'West Bank', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 120, avg_rating: 4.8, total_reviews: 3500, open_hour: 8, close_hour: 17, meal_slot: '', price_range: 'Economy|100-200', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Mortuary temple of Hatshepsut', image: 'https://example.com/hatshepsut.jpg' },
  { attraction_id: 'ATT043', name: 'Colossi of Memnon', city_id: 'CIT005', district: 'West Bank', latitude: 25.7331, longitude: 32.6173, address: 'West Bank', sub_type: 'Monument', is_outdoor: 1, avg_visit_hrs: 0.5, admission_egp: 0, avg_rating: 4.3, total_reviews: 1800, open_hour: 8, close_hour: 17, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Ancient monuments of Memnon', image: 'https://example.com/colossi-memnon.jpg' },
  { attraction_id: 'ATT044', name: 'Aswan High Dam', city_id: 'CIT004', district: 'Aswan', latitude: 23.9698, longitude: 32.8794, address: 'Aswan', sub_type: 'Dam', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 40, avg_rating: 4.1, total_reviews: 1700, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|30-100', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'High dam at Aswan', image: 'https://example.com/aswan-dam.jpg' },
  { attraction_id: 'ATT045', name: 'Philae Temple', city_id: 'CIT004', district: 'Philae', latitude: 24.0165, longitude: 32.8860, address: 'Philae Island', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 180, avg_rating: 4.7, total_reviews: 3200, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|150-250', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Temple at Philae island', image: 'https://example.com/philae.jpg' },
  { attraction_id: 'ATT046', name: 'Nubian Museum', city_id: 'CIT004', district: 'Downtown', latitude: 23.9680, longitude: 32.8816, address: 'Sharia Youssef Al-Guindy', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 2.5, admission_egp: 150, avg_rating: 4.5, total_reviews: 1500, open_hour: 10, close_hour: 18, meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Nubian museum', image: 'https://example.com/nubian-museum.jpg' },
  { attraction_id: 'ATT047', name: 'Abu Simbel Temples', city_id: 'CIT006', district: 'Abu Simbel', latitude: 22.3452, longitude: 31.6089, address: 'Abu Simbel', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 4.9, total_reviews: 2800, open_hour: 8, close_hour: 18, meal_slot: 'lunch', price_range: 'Premium|200-400', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Ancient temples at Abu Simbel', image: 'https://example.com/abu-simbel.jpg' },
  { attraction_id: 'ATT048', name: 'Khan Misr Tulun', city_id: 'CIT001', district: 'Old Cairo', latitude: 30.0043, longitude: 31.2408, address: 'Shar al-Sayyida', sub_type: 'Historic Street', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.2, total_reviews: 1400, open_hour: 10, close_hour: 20, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|30-150', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Historic street in old Cairo', image: 'https://example.com/khan-misr-tulun.jpg' },
  { attraction_id: 'ATT049', name: 'Alexandria Corniche', city_id: 'CIT002', district: 'Downtown', latitude: 31.2945, longitude: 29.9550, address: 'Corniche', sub_type: 'Waterfront', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.4, total_reviews: 4100, open_hour: 9, close_hour: 23, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|50-300', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Beautiful corniche waterfront', image: 'https://example.com/alexandria-corniche.jpg' },
  { attraction_id: 'ATT050', name: 'Bibliotheca Alexandrina', city_id: 'CIT002', district: 'Downtown', latitude: 31.2945, longitude: 29.9545, address: 'Corniche', sub_type: 'Library Museum', is_outdoor: 0, avg_visit_hrs: 2.5, admission_egp: 200, avg_rating: 4.6, total_reviews: 2300, open_hour: 9, close_hour: 19, meal_slot: 'lunch,coffee', price_range: 'Economy|150-250', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Ancient library museum', image: 'https://example.com/bibliotheca.jpg' },
  { attraction_id: 'ATT051', name: 'Al-Fishawy Café', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0609, longitude: 31.2535, address: 'Khan el-Khalili', sub_type: 'Historic Café', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 0, avg_rating: 4.5, total_reviews: 3200, open_hour: 10, close_hour: 23, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|20-100', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Historic café', image: 'https://example.com/al-fishawy.jpg' },
  { attraction_id: 'ATT052', name: 'Umm Kulthum House Museum', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0268, longitude: 31.2360, address: 'Zamalek Island', sub_type: 'House Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 100, avg_rating: 4.3, total_reviews: 1100, open_hour: 10, close_hour: 17, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'House museum', image: 'https://example.com/umm-kulthum.jpg' },
  { attraction_id: 'ATT053', name: 'Abd El-Rahim Sabry Museum', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0270, longitude: 31.2365, address: 'Zamalek Island', sub_type: 'House Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.2, total_reviews: 950, open_hour: 10, close_hour: 17, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'House museum', image: 'https://example.com/abd-el-rahim.jpg' },
  { attraction_id: 'ATT054', name: 'Sohrag Museum', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0258, longitude: 31.2355, address: 'Zamalek Island', sub_type: 'Art Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.1, total_reviews: 850, open_hour: 10, close_hour: 17, meal_slot: '', price_range: 'Economy|50-100', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Art museum', image: 'https://example.com/sohrag-museum.jpg' },
  { attraction_id: 'ATT055', name: 'Nile Barage', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0670, longitude: 31.1000, address: 'Zamalek', sub_type: 'Garden', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 20, avg_rating: 4.0, total_reviews: 1300, open_hour: 9, close_hour: 17, meal_slot: 'lunch,snack', price_range: 'Economy|20-100', crowd_label: 'Medium', crowd_pattern: 'weekend', description: 'Garden on the Nile', image: 'https://example.com/nile-barage.jpg' },
  { attraction_id: 'ATT056', name: 'Al-Azbekeya Gardens', city_id: 'CIT001', district: 'Downtown', latitude: 30.0380, longitude: 31.2400, address: 'Downtown Cairo', sub_type: 'Park', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 10, avg_rating: 3.8, total_reviews: 1100, open_hour: 8, close_hour: 18, meal_slot: 'lunch,snack', price_range: 'Economy|10-100', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend', description: 'Historic gardens', image: 'https://example.com/azbekeya.jpg' },
  { attraction_id: 'ATT057', name: 'Andalusian Garden', city_id: 'CIT001', district: 'Zamalek', latitude: 30.0320, longitude: 31.2340, address: 'Gezira Island', sub_type: 'Park', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 15, avg_rating: 3.9, total_reviews: 1200, open_hour: 9, close_hour: 18, meal_slot: 'snack', price_range: 'Economy|15-100', crowd_label: 'Medium', crowd_pattern: 'weekend', description: 'Andalusian garden', image: 'https://example.com/andalusian.jpg' },
  { attraction_id: 'ATT058', name: 'Silvester Park', city_id: 'CIT001', district: 'Downtown', latitude: 30.0390, longitude: 31.2380, address: 'Downtown Cairo', sub_type: 'Park', is_outdoor: 1, avg_visit_hrs: 1, admission_egp: 0, avg_rating: 3.7, total_reviews: 950, open_hour: 8, close_hour: 18, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Park in downtown', image: 'https://example.com/silvester.jpg' },
  { attraction_id: 'ATT059', name: 'Amir Taz Palace', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0580, longitude: 31.2490, address: 'Islamic Cairo', sub_type: 'Palace Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.2, total_reviews: 1050, open_hour: 10, close_hour: 16, meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Palace museum', image: 'https://example.com/amir-taz.jpg' },
  { attraction_id: 'ATT060', name: 'Mausoleum of Sultan Barquq', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0625, longitude: 31.2545, address: 'Islamic Cairo', sub_type: 'Mausoleum', is_outdoor: 1, avg_visit_hrs: 1, admission_egp: 10, avg_rating: 4.1, total_reviews: 950, open_hour: 9, close_hour: 18, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Historic mausoleum', image: 'https://example.com/mausoleum.jpg' },
  { attraction_id: 'ATT061', name: 'School of Sultan al-Nasir Muhammad', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0615, longitude: 31.2520, address: 'Islamic Cairo', sub_type: 'Historic Building', is_outdoor: 0, avg_visit_hrs: 1, admission_egp: 15, avg_rating: 4.0, total_reviews: 850, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Historic school building', image: 'https://example.com/school.jpg' },
  { attraction_id: 'ATT062', name: 'Bab Zuweila Gate', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0530, longitude: 31.2480, address: 'Islamic Cairo', sub_type: 'Gate', is_outdoor: 1, avg_visit_hrs: 1, admission_egp: 20, avg_rating: 4.1, total_reviews: 1150, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Historic gate', image: 'https://example.com/bab-zuweila.jpg' },
  { attraction_id: 'ATT063', name: 'Ibn Tulun Mosque', city_id: 'CIT001', district: 'Old Cairo', latitude: 30.0256, longitude: 31.2434, address: 'Ibn Tulun', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 20, avg_rating: 4.3, total_reviews: 1550, open_hour: 8, close_hour: 18, meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Ancient mosque', image: 'https://example.com/ibn-tulun.jpg' },
  { attraction_id: 'ATT064', name: 'Muhammad Ali Mosque', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 2, admission_egp: 30, avg_rating: 4.6, total_reviews: 2700, open_hour: 8, close_hour: 18, meal_slot: '', price_range: 'Economy|0-100', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Beautiful mosque', image: 'https://example.com/muhammad-ali.jpg' },
  { attraction_id: 'ATT065', name: 'Military Museum', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 2, admission_egp: 50, avg_rating: 4.2, total_reviews: 1450, open_hour: 9, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'Military museum', image: 'https://example.com/military-museum.jpg' },
  { attraction_id: 'ATT066', name: 'Carriage Museum', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 40, avg_rating: 4.1, total_reviews: 1200, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|30-100', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Carriage museum', image: 'https://example.com/carriage-museum.jpg' },
  { attraction_id: 'ATT067', name: 'Al-Gawhara Palace', city_id: 'CIT001', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', sub_type: 'Palace Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.2, total_reviews: 1250, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|50-100', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Palace museum', image: 'https://example.com/al-gawhara.jpg' },
  { attraction_id: 'ATT068', name: 'Suez Canal', city_id: 'CIT007', district: 'Suez', latitude: 30.5891, longitude: 32.2663, address: 'Suez', sub_type: 'Waterway', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.2, total_reviews: 1400, open_hour: 9, close_hour: 18, meal_slot: 'lunch', price_range: 'Economy|0-100', crowd_label: 'Medium', crowd_pattern: 'weekday', description: 'Historic waterway', image: 'https://example.com/suez-canal.jpg' },
  { attraction_id: 'ATT069', name: 'Wadi El-Rayan Protected Area', city_id: 'CIT008', district: 'Fayoum', latitude: 29.3800, longitude: 30.5400, address: 'Fayoum', sub_type: 'Nature Reserve', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 50, avg_rating: 4.3, total_reviews: 1600, open_hour: 8, close_hour: 18, meal_slot: 'lunch,snack', price_range: 'Economy|30-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday,weekend', description: 'Nature reserve', image: 'https://example.com/wadi-rayan.jpg' },
  { attraction_id: 'ATT070', name: 'Lake Qarun', city_id: 'CIT008', district: 'Fayoum', latitude: 29.4500, longitude: 30.7500, address: 'Fayoum', sub_type: 'Lake', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 30, avg_rating: 4.2, total_reviews: 1450, open_hour: 8, close_hour: 20, meal_slot: 'lunch,dinner,snack', price_range: 'Economy|30-200', crowd_label: 'Medium-High', crowd_pattern: 'weekend', description: 'Salt lake', image: 'https://example.com/lake-qarun.jpg' },
  { attraction_id: 'ATT071', name: 'Sharm El-Sheikh', city_id: 'CIT009', district: 'Sharm', latitude: 27.8660, longitude: 34.3391, address: 'Sharm El-Sheikh', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 0, avg_rating: 4.5, total_reviews: 4500, open_hour: 24, close_hour: 24, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Premium|100-500', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Beach resort destination', image: 'https://example.com/sharm-el-sheikh.jpg' },
  { attraction_id: 'ATT072', name: 'Ras Mohammed National Park', city_id: 'CIT009', district: 'Sharm', latitude: 27.7372, longitude: 34.2756, address: 'Ras Mohammed', sub_type: 'National Park', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 100, avg_rating: 4.6, total_reviews: 2300, open_hour: 8, close_hour: 17, meal_slot: 'lunch', price_range: 'Economy|100-250', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'National park', image: 'https://example.com/ras-mohammed.jpg' },
  { attraction_id: 'ATT073', name: 'Dahab', city_id: 'CIT009', district: 'Dahab', latitude: 28.5033, longitude: 34.5200, address: 'Dahab', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 0, avg_rating: 4.4, total_reviews: 2200, open_hour: 24, close_hour: 24, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|50-300', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Beach town', image: 'https://example.com/dahab.jpg' },
  { attraction_id: 'ATT074', name: 'Hurghada', city_id: 'CIT010', district: 'Hurghada', latitude: 27.2564, longitude: 33.8136, address: 'Hurghada', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 0, avg_rating: 4.6, total_reviews: 4700, open_hour: 24, close_hour: 24, meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Premium|100-500', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Beach resort', image: 'https://example.com/hurghada.jpg' },
  { attraction_id: 'ATT075', name: 'Mahmya Island', city_id: 'CIT010', district: 'Hurghada', latitude: 27.3500, longitude: 33.7500, address: 'Red Sea', sub_type: 'Island', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 4.5, total_reviews: 1800, open_hour: 8, close_hour: 18, meal_slot: 'lunch,snack', price_range: 'Premium|150-400', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Island resort', image: 'https://example.com/mahmya-island.jpg' },
  { attraction_id: 'ATT076', name: 'Giftun Island', city_id: 'CIT010', district: 'Hurghada', latitude: 27.3000, longitude: 33.8000, address: 'Red Sea', sub_type: 'Island', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 150, avg_rating: 4.4, total_reviews: 1700, open_hour: 8, close_hour: 18, meal_slot: 'lunch', price_range: 'Premium|100-350', crowd_label: 'High', crowd_pattern: 'weekday,weekend', description: 'Island', image: 'https://example.com/giftun-island.jpg' },
  { attraction_id: 'ATT077', name: 'Sidi Abdel Rahman Beach', city_id: 'CIT011', district: 'Alamein', latitude: 30.8333, longitude: 28.5500, address: 'Alamein', sub_type: 'Beach', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 30, avg_rating: 4.3, total_reviews: 1800, open_hour: 8, close_hour: 20, meal_slot: 'lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Beach', image: 'https://example.com/sidi-abdel-rahman.jpg' },
  { attraction_id: 'ATT078', name: 'Marsa Matrouh', city_id: 'CIT012', district: 'Matrouh', latitude: 31.3537, longitude: 27.2374, address: 'Matrouh', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 20, avg_rating: 4.2, total_reviews: 1500, open_hour: 9, close_hour: 20, meal_slot: 'lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Beach resort', image: 'https://example.com/marsa-matrouh.jpg' },
  { attraction_id: 'ATT079', name: 'Alamein World War Cemetery', city_id: 'CIT011', district: 'Alamein', latitude: 30.8233, longitude: 28.5383, address: 'Alamein', sub_type: 'Cemetery', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 50, avg_rating: 4.4, total_reviews: 1300, open_hour: 9, close_hour: 17, meal_slot: '', price_range: 'Economy|50-100', crowd_label: 'Low-Medium', crowd_pattern: 'weekday', description: 'War cemetery', image: 'https://example.com/alamein-cemetery.jpg' },
  { attraction_id: 'ATT080', name: 'Siwa Oasis', city_id: 'CIT013', district: 'Siwa', latitude: 29.2029, longitude: 25.5164, address: 'Siwa', sub_type: 'Oasis', is_outdoor: 1, avg_visit_hrs: 5, admission_egp: 100, avg_rating: 4.5, total_reviews: 1600, open_hour: 8, close_hour: 19, meal_slot: 'lunch,dinner', price_range: 'Premium|100-300', crowd_label: 'Low-Medium', crowd_pattern: 'weekday,weekend', description: 'Desert oasis', image: 'https://example.com/siwa-oasis.jpg' },
  { attraction_id: 'ATT081', name: 'White Desert', city_id: 'CIT013', district: 'Farafra', latitude: 27.8200, longitude: 29.5500, address: 'Farafra', sub_type: 'Nature Reserve', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 80, avg_rating: 4.5, total_reviews: 1500, open_hour: 8, close_hour: 18, meal_slot: 'lunch,dinner', price_range: 'Premium|100-250', crowd_label: 'Low-Medium', crowd_pattern: 'weekday,weekend', description: 'White desert nature reserve', image: 'https://example.com/white-desert.jpg' },
  { attraction_id: 'ATT082', name: 'Black Desert', city_id: 'CIT013', district: 'Bahariyya', latitude: 28.3500, longitude: 29.5000, address: 'Bahariyya', sub_type: 'Nature Reserve', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 60, avg_rating: 4.3, total_reviews: 1300, open_hour: 8, close_hour: 18, meal_slot: 'lunch,dinner', price_range: 'Premium|100-200', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Black desert reserve', image: 'https://example.com/black-desert.jpg' },
  { attraction_id: 'ATT083', name: 'Baharia Oasis', city_id: 'CIT013', district: 'Bahariyya', latitude: 28.3700, longitude: 29.5200, address: 'Bahariyya', sub_type: 'Oasis', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 50, avg_rating: 4.2, total_reviews: 1200, open_hour: 8, close_hour: 18, meal_slot: 'lunch,dinner', price_range: 'Economy|50-200', crowd_label: 'Low', crowd_pattern: 'weekday', description: 'Desert oasis', image: 'https://example.com/baharia-oasis.jpg' },
  { attraction_id: 'ATT084', name: 'Mandara Beach', city_id: 'CIT002', district: 'Mandara', latitude: 31.2607, longitude: 30.0319, address: 'Mandara, Alexandria', sub_type: 'Public Beach', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 20, avg_rating: 4.0, total_reviews: 1200, open_hour: 9, close_hour: 20, meal_slot: 'lunch,dinner,snack', price_range: 'Economy|20-100', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Public beach', image: 'https://example.com/mandara-beach.jpg' },
  { attraction_id: 'ATT085', name: 'Haramosis Beach', city_id: 'CIT002', district: 'Agami', latitude: 31.1025, longitude: 29.7321, address: 'Agami, Alexandria', sub_type: 'Public Beach', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 0, avg_rating: 3.8, total_reviews: 1800, open_hour: 9, close_hour: 18, meal_slot: 'lunch,dinner', price_range: 'Economy|20-100', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Public beach', image: 'https://example.com/haramosis.jpg' },
  { attraction_id: 'ATT086', name: 'Abu Qir Bay Seafront', city_id: 'CIT002', district: 'Abu Qir', latitude: 31.3100, longitude: 30.0019, address: 'Abu Qir, Alexandria', sub_type: 'Bay Seafront', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.2, total_reviews: 2100, open_hour: 9, close_hour: 24, meal_slot: 'lunch,dinner,snack', price_range: 'Economy|0-100', crowd_label: 'High', crowd_pattern: 'weekend', description: 'Bay seafront', image: 'https://example.com/abu-qir.jpg' },
  { attraction_id: 'ATT087', name: 'Mamoura Beach', city_id: 'CIT002', district: 'Mamoura', latitude: 31.2881, longitude: 30.0171, address: 'Mamoura Palace Area, Alexandria', sub_type: 'Private Beach', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 30, avg_rating: 4.4, total_reviews: 4500, open_hour: 9, close_hour: 20, meal_slot: 'lunch,dinner,snack', price_range: 'Economy|30-150', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend', description: 'Private beach', image: 'https://example.com/mamoura.jpg' }
];

async function initializeDatabase() {
  try {
    // Run migrations first (creates attraction_images table)
    await runMigrations();
    console.log('Starting database initialization...');

    // Create users table
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        language VARCHAR(50),
        current_city VARCHAR(100),
        accessibility_needs VARCHAR(255) DEFAULT 'None',
        is_admin BOOLEAN DEFAULT false,
        eco_points INTEGER,
        sustainability_level VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create cities table
    const createCitiesTableQuery = `
      CREATE TABLE IF NOT EXISTS cities (
        city_id VARCHAR(50) PRIMARY KEY,
        city_name VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create categories table
    const createCategoriesTableQuery = `
      CREATE TABLE IF NOT EXISTS categories (
        category_id VARCHAR(50) PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create attractions table
    const createAttractionsTableQuery = `
      CREATE TABLE IF NOT EXISTS attractions (
        attraction_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city_id VARCHAR(50) NOT NULL,
        district VARCHAR(100),
        latitude DECIMAL(10, 4),
        longitude DECIMAL(10, 4),
        address TEXT,
        sub_type VARCHAR(100),
        is_outdoor INTEGER,
        avg_visit_hrs DECIMAL(3, 1),
        admission_egp INTEGER,
        avg_rating DECIMAL(3, 1),
        total_reviews INTEGER,
        open_hour INTEGER,
        close_hour INTEGER,
        meal_slot VARCHAR(200),
        price_range VARCHAR(100),
        crowd_label VARCHAR(50),
        crowd_pattern VARCHAR(100),
        description TEXT,
        image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (city_id) REFERENCES cities(city_id) ON DELETE SET NULL
      );
    `;

    // Create attraction_categories junction table
    const createAttractionCategoriesTableQuery = `
      CREATE TABLE IF NOT EXISTS attraction_categories (
        attraction_id VARCHAR(50) NOT NULL,
        category_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (attraction_id, category_id),
        FOREIGN KEY (attraction_id) REFERENCES attractions(attraction_id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
      );
    `;

    // Create user_liked_attractions table
    const createUserLikedAttractionsTableQuery = `
      CREATE TABLE IF NOT EXISTS user_liked_attractions (
        user_id VARCHAR(50) NOT NULL,
        attraction_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, attraction_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (attraction_id) REFERENCES attractions(attraction_id) ON DELETE CASCADE
      );
    `;

    await pool.query(createUsersTableQuery);
    console.log('✓ Users table created/verified');

    await pool.query(createCitiesTableQuery);
    console.log('✓ Cities table created/verified');

    await pool.query(createCategoriesTableQuery);
    console.log('✓ Categories table created/verified');

    await pool.query(createAttractionsTableQuery);
    console.log('✓ Attractions table created/verified');

    await pool.query(createAttractionCategoriesTableQuery);
    console.log('✓ Attraction categories table created/verified');

    await pool.query(createUserLikedAttractionsTableQuery);
    console.log('✓ User liked attractions table created/verified');

    // Insert users data
    const insertUserQuery = `
      INSERT INTO users (
        user_id, name, email, password, language, current_city, 
        accessibility_needs, is_admin, 
        eco_points, sustainability_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id) DO NOTHING;
    `;

    for (const user of usersData) {
      await pool.query(insertUserQuery, [
        user.user_id,
        user.name,
        user.email,
        user.password,
        user.language,
        user.current_city,
        user.accessibility_needs,
        user.is_admin,
        user.eco_points,
        user.sustainability_level
      ]);
    }

    console.log('✓ Inserted ' + usersData.length + ' users into database');

    // Insert cities data
    const insertCityQuery = `
      INSERT INTO cities (city_id, city_name, country)
      VALUES ($1, $2, $3)
      ON CONFLICT (city_id) DO NOTHING;
    `;

    for (const city of citiesData) {
      await pool.query(insertCityQuery, [
        city.city_id,
        city.city_name,
        city.country
      ]);
    }

    console.log('✓ Inserted ' + citiesData.length + ' cities into database');

    // Insert categories data
    const insertCategoryQuery = `
      INSERT INTO categories (category_id, category_name)
      VALUES ($1, $2)
      ON CONFLICT (category_id) DO NOTHING;
    `;

    for (const category of categoriesData) {
      await pool.query(insertCategoryQuery, [
        category.category_id,
        category.category_name
      ]);
    }

    // Insert attractions data
    const insertAttractionQuery = `
      INSERT INTO attractions (
        attraction_id, name, city_id, district, latitude, longitude, address, 
        sub_type, is_outdoor, avg_visit_hrs, admission_egp, 
        avg_rating, total_reviews, open_hour, close_hour, 
        meal_slot, price_range, crowd_label, crowd_pattern, description, image
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (attraction_id) DO NOTHING;
    `;

    for (const attraction of attractionsData) {
      await pool.query(insertAttractionQuery, [
        attraction.attraction_id,
        attraction.name,
        attraction.city_id,
        attraction.district,
        attraction.latitude,
        attraction.longitude,
        attraction.address,
        attraction.sub_type,
        attraction.is_outdoor,
        attraction.avg_visit_hrs,
        attraction.admission_egp,
        attraction.avg_rating,
        attraction.total_reviews,
        attraction.open_hour,
        attraction.close_hour,
        attraction.meal_slot,
        attraction.price_range,
        attraction.crowd_label,
        attraction.crowd_pattern,
        attraction.description,
        attraction.image
      ]);
    }

    console.log('✓ Inserted ' + attractionsData.length + ' attractions into database');

    // Insert attraction categories data
    const insertAttractionCategoryQuery = `
      INSERT INTO attraction_categories (attraction_id, category_id)
      VALUES ($1, $2)
      ON CONFLICT (attraction_id, category_id) DO NOTHING;
    `;

    let totalCategoryInserts = 0;
    for (const [attractionId, categoryIds] of Object.entries(attractionCategoriesMap)) {
      for (const categoryId of categoryIds) {
        await pool.query(insertAttractionCategoryQuery, [attractionId, categoryId]);
        totalCategoryInserts++;
      }
    }

    console.log('✓ Inserted ' + totalCategoryInserts + ' attraction category mappings into database');

    // Insert user liked attractions data
    const insertUserLikedAttractionQuery = `
      INSERT INTO user_liked_attractions (user_id, attraction_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, attraction_id) DO NOTHING;
    `;

    for (const record of userLikedAttractionsData) {
      await pool.query(insertUserLikedAttractionQuery, [
        record.user_id,
        record.attraction_id
      ]);
    }

    console.log('✓ Inserted ' + userLikedAttractionsData.length + ' user liked attractions into database');

    // Insert sample image data for attractions
    const insertImageQuery = `
      INSERT INTO attraction_images (attraction_id, image_url, filename)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING;
    `;

    const sampleImages = [
      // Multiple images per popular attraction
      { attraction_id: 'ATT001', image_url: 'http://localhost:3000/uploads/attraction-ATT001-1.jpg', filename: 'attraction-ATT001-1.jpg' },
      { attraction_id: 'ATT001', image_url: 'http://localhost:3000/uploads/attraction-ATT001-2.jpg', filename: 'attraction-ATT001-2.jpg' },
      { attraction_id: 'ATT001', image_url: 'http://localhost:3000/uploads/attraction-ATT001-3.jpg', filename: 'attraction-ATT001-3.jpg' },
      
      { attraction_id: 'ATT002', image_url: 'http://localhost:3000/uploads/attraction-ATT002-1.jpg', filename: 'attraction-ATT002-1.jpg' },
      { attraction_id: 'ATT002', image_url: 'http://localhost:3000/uploads/attraction-ATT002-2.jpg', filename: 'attraction-ATT002-2.jpg' },
      
      { attraction_id: 'ATT003', image_url: 'http://localhost:3000/uploads/attraction-ATT003-1.jpg', filename: 'attraction-ATT003-1.jpg' },
      { attraction_id: 'ATT003', image_url: 'http://localhost:3000/uploads/attraction-ATT003-2.jpg', filename: 'attraction-ATT003-2.jpg' },
      
      { attraction_id: 'ATT005', image_url: 'http://localhost:3000/uploads/attraction-ATT005-1.jpg', filename: 'attraction-ATT005-1.jpg' },
      { attraction_id: 'ATT005', image_url: 'http://localhost:3000/uploads/attraction-ATT005-2.jpg', filename: 'attraction-ATT005-2.jpg' },
      
      { attraction_id: 'ATT014', image_url: 'http://localhost:3000/uploads/attraction-ATT014-1.jpg', filename: 'attraction-ATT014-1.jpg' },
      { attraction_id: 'ATT014', image_url: 'http://localhost:3000/uploads/attraction-ATT014-2.jpg', filename: 'attraction-ATT014-2.jpg' },
      
      { attraction_id: 'ATT017', image_url: 'http://localhost:3000/uploads/attraction-ATT017-1.jpg', filename: 'attraction-ATT017-1.jpg' },
      { attraction_id: 'ATT017', image_url: 'http://localhost:3000/uploads/attraction-ATT017-2.jpg', filename: 'attraction-ATT017-2.jpg' },
      
      { attraction_id: 'ATT034', image_url: 'http://localhost:3000/uploads/attraction-ATT034-1.jpg', filename: 'attraction-ATT034-1.jpg' },
      { attraction_id: 'ATT034', image_url: 'http://localhost:3000/uploads/attraction-ATT034-2.jpg', filename: 'attraction-ATT034-2.jpg' },
      
      { attraction_id: 'ATT039', image_url: 'http://localhost:3000/uploads/attraction-ATT039-1.jpg', filename: 'attraction-ATT039-1.jpg' },
      { attraction_id: 'ATT039', image_url: 'http://localhost:3000/uploads/attraction-ATT039-2.jpg', filename: 'attraction-ATT039-2.jpg' },
      { attraction_id: 'ATT039', image_url: 'http://localhost:3000/uploads/attraction-ATT039-3.jpg', filename: 'attraction-ATT039-3.jpg' },
      
      { attraction_id: 'ATT041', image_url: 'http://localhost:3000/uploads/attraction-ATT041-1.jpg', filename: 'attraction-ATT041-1.jpg' },
      { attraction_id: 'ATT041', image_url: 'http://localhost:3000/uploads/attraction-ATT041-2.jpg', filename: 'attraction-ATT041-2.jpg' },
      
      { attraction_id: 'ATT049', image_url: 'http://localhost:3000/uploads/attraction-ATT049-1.jpg', filename: 'attraction-ATT049-1.jpg' },
      { attraction_id: 'ATT049', image_url: 'http://localhost:3000/uploads/attraction-ATT049-2.jpg', filename: 'attraction-ATT049-2.jpg' },
      
      { attraction_id: 'ATT071', image_url: 'http://localhost:3000/uploads/attraction-ATT071-1.jpg', filename: 'attraction-ATT071-1.jpg' },
      { attraction_id: 'ATT071', image_url: 'http://localhost:3000/uploads/attraction-ATT071-2.jpg', filename: 'attraction-ATT071-2.jpg' }
    ];

    for (const image of sampleImages) {
      await pool.query(insertImageQuery, [
        image.attraction_id,
        image.image_url,
        image.filename
      ]);
    }

    console.log('✓ Inserted ' + sampleImages.length + ' sample images into database');

    // Verify the data
    const usersResult = await pool.query('SELECT COUNT(*) FROM users;');
    const citiesResult = await pool.query('SELECT COUNT(*) FROM cities;');
    const categoriesResult = await pool.query('SELECT COUNT(*) FROM categories;');
    const attractionsResult = await pool.query('SELECT COUNT(*) FROM attractions;');
    const attractionCategoriesResult = await pool.query('SELECT COUNT(*) FROM attraction_categories;');
    const userLikedAttractionsResult = await pool.query('SELECT COUNT(*) FROM user_liked_attractions;');
    const attractionImagesResult = await pool.query('SELECT COUNT(*) FROM attraction_images;');
    
    console.log('✓ Total users in database:', usersResult.rows[0].count);
    console.log('✓ Total cities in database:', citiesResult.rows[0].count);
    console.log('✓ Total categories in database:', categoriesResult.rows[0].count);
    console.log('✓ Total attractions in database:', attractionsResult.rows[0].count);
    console.log('✓ Total attraction categories in database:', attractionCategoriesResult.rows[0].count);
    console.log('✓ Total user liked attractions in database:', userLikedAttractionsResult.rows[0].count);
    console.log('✓ Total attraction images in database:', attractionImagesResult.rows[0].count);

    console.log('\n✓ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();
