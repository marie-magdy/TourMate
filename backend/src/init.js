import pool from './db.js';

const usersData = [
  {
    user_id: 'USR001',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@tourmate.com',
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMYeIjZAgcg7b3XeKeUxWdeS86E36DRcT36', // hashed: password123
    language: 'English',
    current_city: 'Cairo',
    home_country: 'UK',
    tourist_type: 'International',
    preferred_categories: 'historical,ancient,museum',
    disliked_categories: 'nightlife',
    accessibility_needs: 'None',
    budget_egp: 2000,
    available_hour: 8,
    liked_attraction_ids: 'ATT001,ATT002',
    visited_attraction_ids: 'ATT001',
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
    home_country: 'Egypt',
    tourist_type: 'Local',
    preferred_categories: 'restaurant,cafe,cultural,historical',
    disliked_categories: 'shopping',
    accessibility_needs: 'None',
    budget_egp: 500,
    available_hour: 6,
    liked_attraction_ids: 'ATT033,ATT041',
    visited_attraction_ids: 'ATT004,ATT005',
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
    home_country: 'France',
    tourist_type: 'International',
    preferred_categories: 'museum,cafe,coastal,beach',
    disliked_categories: 'hiking',
    accessibility_needs: 'Wheelchair',
    budget_egp: 3000,
    available_hour: 5,
    liked_attraction_ids: 'ATT050,ATT077',
    visited_attraction_ids: 'ATT049',
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
    home_country: 'Egypt',
    tourist_type: 'Local',
    preferred_categories: 'park,outdoor,restaurant,cafe',
    disliked_categories: 'museum',
    accessibility_needs: 'None',
    budget_egp: 800,
    available_hour: 10,
    liked_attraction_ids: 'ATT013,ATT039',
    visited_attraction_ids: 'ATT003,ATT011',
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
    home_country: 'Australia',
    tourist_type: 'International',
    preferred_categories: 'beach,coastal,outdoor,restaurant',
    disliked_categories: 'indoor,museum',
    accessibility_needs: 'None',
    budget_egp: 4000,
    available_hour: 7,
    liked_attraction_ids: 'ATT082,ATT071',
    visited_attraction_ids: 'ATT049,ATT058',
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
    home_country: 'Saudi Arabia',
    tourist_type: 'International',
    preferred_categories: 'religious,historical,mall,shopping',
    disliked_categories: 'outdoor',
    accessibility_needs: 'None',
    budget_egp: 1500,
    available_hour: 8,
    liked_attraction_ids: 'ATT005,ATT007',
    visited_attraction_ids: 'ATT005,ATT006',
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
    home_country: 'Egypt',
    tourist_type: 'Local',
    preferred_categories: 'historical,ancient,outdoor,cafe',
    disliked_categories: 'shopping',
    accessibility_needs: 'None',
    budget_egp: 400,
    available_hour: 5,
    liked_attraction_ids: 'ATT049,ATT077',
    visited_attraction_ids: 'ATT049,ATT052,ATT055',
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
    home_country: 'Egypt',
    tourist_type: 'Local',
    preferred_categories: 'museum,cafe,cultural,indoor',
    disliked_categories: 'crowded',
    accessibility_needs: 'None',
    budget_egp: 300,
    available_hour: 4,
    liked_attraction_ids: 'ATT002,ATT041',
    visited_attraction_ids: 'ATT002',
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
    home_country: 'USA',
    tourist_type: 'International',
    preferred_categories: 'historical,ancient,outdoor,restaurant',
    disliked_categories: 'religious',
    accessibility_needs: 'None',
    budget_egp: 3500,
    available_hour: 9,
    liked_attraction_ids: 'ATT001,ATT034',
    visited_attraction_ids: 'ATT001,ATT007',
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
    home_country: 'Egypt',
    tourist_type: 'Local',
    preferred_categories: 'beach,coastal,cafe,restaurant,outdoor',
    disliked_categories: 'indoor,museum',
    accessibility_needs: 'None',
    budget_egp: 600,
    available_hour: 6,
    liked_attraction_ids: 'ATT082,ATT078',
    visited_attraction_ids: 'ATT058,ATT065,ATT083',
    eco_points: 110,
    sustainability_level: 'Gold'
  }
];

const attractionsData = [
  { attraction_id: 'ATT001', name: 'Great Pyramid of Giza', city: 'Giza', district: 'Giza', latitude: 29.9792, longitude: 31.1342, address: 'Giza Plateau', categories: 'historical,ancient', sub_type: 'Monument', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 300, avg_rating: 4.8, popularity: 0.95, total_reviews: 5000, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch,dinner', price_range: 'Premium|200-500', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT002', name: 'Egyptian Museum', city: 'Cairo', district: 'Downtown', latitude: 30.0361, longitude: 31.2365, address: 'Tahrir Square', categories: 'museum,cultural', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 4, admission_egp: 120, avg_rating: 4.6, popularity: 0.90, total_reviews: 4500, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT003', name: 'Khan el-Khalili Bazaar', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0609, longitude: 31.2535, address: 'Al-Gamaliya Street', categories: 'shopping,cultural', sub_type: 'Market', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.4, popularity: 0.88, total_reviews: 3800, open_hour: 10, close_hour: 22, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: 'breakfast,lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT004', name: 'Al-Azhar Mosque', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0634, longitude: 31.2629, address: 'Al-Azhar Street', categories: 'religious,ancient,cultural', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 10, avg_rating: 4.5, popularity: 0.82, total_reviews: 2200, open_hour: 8, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT005', name: 'Citadel of Saladin', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0281, longitude: 31.2629, address: 'Al-Qala Street', categories: 'historical,ancient,cultural', sub_type: 'Fortress', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 80, avg_rating: 4.5, popularity: 0.85, total_reviews: 3200, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT006', name: 'Islamic Art Museum', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0434, longitude: 31.2532, address: 'Bab al-Khalq', categories: 'museum,cultural', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 100, avg_rating: 4.4, popularity: 0.75, total_reviews: 1800, open_hour: 9, close_hour: 16, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT007', name: 'Coptic Cairo', city: 'Cairo', district: 'Old Cairo', latitude: 30.0048, longitude: 31.2371, address: 'Mari Girgis Street', categories: 'religious,historical,cultural', sub_type: 'Historic District', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 50, avg_rating: 4.3, popularity: 0.78, total_reviews: 2100, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT008', name: 'Giza Zoo', city: 'Giza', district: 'Giza', latitude: 30.0147, longitude: 31.1882, address: 'Omar Ibn Al-Khattab Street', categories: 'outdoor,family', sub_type: 'Zoo', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 40, avg_rating: 3.8, popularity: 0.70, total_reviews: 1500, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,snack', price_range: 'Economy|30-100', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT009', name: 'National Museum of Egyptian Civilization', city: 'Cairo', district: 'Fustat', latitude: 30.0003, longitude: 31.2437, address: 'Al-Cornish', categories: 'museum,cultural,historical', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 4.5, popularity: 0.72, total_reviews: 1200, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|100-250', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT010', name: 'Nile River Cruise', city: 'Cairo', district: 'Downtown', latitude: 30.0467, longitude: 31.2358, address: 'Nile Corniche', categories: 'beach,outdoor,restaurant', sub_type: 'Activity', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 150, avg_rating: 4.2, popularity: 0.80, total_reviews: 2800, open_hour: 18, close_hour: 23, pedestrian_friendly: 0, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'No', meal_slot: 'dinner', price_range: 'Premium|100-400', crowd_label: 'Medium-High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT011', name: 'Al-Hakim Mosque', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0651, longitude: 31.2476, address: 'Khan al-Khalili', categories: 'religious,ancient,cultural', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 15, avg_rating: 4.3, popularity: 0.68, total_reviews: 1400, open_hour: 8, close_hour: 19, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT012', name: 'Sayyida Zainab Mosque', city: 'Cairo', district: 'Old Cairo', latitude: 30.0174, longitude: 31.2381, address: 'Sayyida Zainab Square', categories: 'religious,cultural', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 10, avg_rating: 4.2, popularity: 0.65, total_reviews: 1100, open_hour: 8, close_hour: 19, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT013', name: 'Al-Muizz Street', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0616, longitude: 31.2503, address: 'Al-Muizz Li-Din Allah Street', categories: 'historical,cultural,shopping', sub_type: 'Historic Street', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.4, popularity: 0.85, total_reviews: 2900, open_hour: 10, close_hour: 22, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,dinner', price_range: 'Economy|30-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT014', name: 'Manara of Alexandria', city: 'Alexandria', district: 'Qaitbay', latitude: 31.2618, longitude: 29.8830, address: 'Corniche', categories: 'historical,ancient,coastal', sub_type: 'Lighthouse', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 80, avg_rating: 4.5, popularity: 0.92, total_reviews: 4200, open_hour: 9, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT015', name: 'Pompey\'s Pillar', city: 'Alexandria', district: 'Karnak', latitude: 31.2107, longitude: 29.9123, address: 'Karnak Area', categories: 'historical,ancient', sub_type: 'Monument', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.2, popularity: 0.70, total_reviews: 1600, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT016', name: 'Alexandria National Museum', city: 'Alexandria', district: 'Downtown', latitude: 31.2956, longitude: 29.9653, address: 'El Horreya Avenue', categories: 'museum,cultural,historical', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 150, avg_rating: 4.3, popularity: 0.75, total_reviews: 1800, open_hour: 10, close_hour: 16, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT017', name: 'Qaitbay Citadel', city: 'Alexandria', district: 'Qaitbay', latitude: 31.2618, longitude: 29.8833, address: 'Corniche', categories: 'historical,ancient,fortress', sub_type: 'Fortress', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.4, popularity: 0.80, total_reviews: 2400, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT018', name: 'Montaza Palace', city: 'Alexandria', district: 'Montaza', latitude: 31.3158, longitude: 29.9890, address: 'Montaza Gardens', categories: 'historical,park,coastal', sub_type: 'Palace', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 80, avg_rating: 4.5, popularity: 0.88, total_reviews: 3300, open_hour: 8, close_hour: 19, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT019', name: 'Alexandria Citadel', city: 'Alexandria', district: 'Downtown', latitude: 31.2950, longitude: 29.9658, address: 'Downtown Area', categories: 'historical,ancient,fortress', sub_type: 'Fortress', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 60, avg_rating: 4.2, popularity: 0.68, total_reviews: 1500, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT020', name: 'Serapeum of Alexandria', city: 'Alexandria', district: 'Karnak', latitude: 31.2107, longitude: 29.9120, address: 'Karnak Area', categories: 'historical,ancient,museum', sub_type: 'Archaeological Site', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 50, avg_rating: 4.1, popularity: 0.60, total_reviews: 1200, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT021', name: 'Catacombs of Kom el Shoqafa', city: 'Alexandria', district: 'Karnak', latitude: 31.2080, longitude: 29.9130, address: 'Karnak Area', categories: 'historical,ancient,museum', sub_type: 'Archaeological Site', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.3, popularity: 0.72, total_reviews: 1700, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT022', name: 'Alexandria Aquarium', city: 'Alexandria', district: 'Qaitbay', latitude: 31.2620, longitude: 29.8835, address: 'Corniche', categories: 'family,outdoor', sub_type: 'Aquarium', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 70, avg_rating: 3.8, popularity: 0.70, total_reviews: 1600, open_hour: 10, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'snack,lunch', price_range: 'Economy|50-150', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT023', name: 'Abdeen Palace Museum', city: 'Cairo', district: 'Downtown', latitude: 30.0283, longitude: 31.2506, address: 'Abdeen Square', categories: 'museum,historical,cultural', sub_type: 'Palace Museum', is_outdoor: 0, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.3, popularity: 0.72, total_reviews: 1600, open_hour: 9, close_hour: 15, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT024', name: 'Manial Palace Museum', city: 'Cairo', district: 'Manial', latitude: 30.0157, longitude: 31.2422, address: 'Manial Island', categories: 'museum,historical,cultural', sub_type: 'Palace Museum', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 80, avg_rating: 4.4, popularity: 0.70, total_reviews: 1500, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT025', name: 'Gayer-Anderson Museum', city: 'Cairo', district: 'Old Cairo', latitude: 30.0054, longitude: 31.2378, address: 'Khan Misr Tulun', categories: 'museum,historical,cultural', sub_type: 'House Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.3, popularity: 0.65, total_reviews: 1200, open_hour: 10, close_hour: 16, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT026', name: 'Islamic Museum of Cairo', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0415, longitude: 31.2522, address: 'Bab al-Khalq', categories: 'museum,cultural,historical', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 3, admission_egp: 100, avg_rating: 4.4, popularity: 0.75, total_reviews: 1800, open_hour: 9, close_hour: 16, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT027', name: 'Textile Museum', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0610, longitude: 31.2530, address: 'Khan el-Khalili', categories: 'museum,cultural', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.2, popularity: 0.60, total_reviews: 1000, open_hour: 10, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT028', name: 'Pharaonic Village', city: 'Cairo', district: 'Zamalek', latitude: 30.0268, longitude: 31.2326, address: 'Zamalek Island', categories: 'museum,historical,cultural', sub_type: 'Theme Park', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 3.9, popularity: 0.72, total_reviews: 1700, open_hour: 10, close_hour: 19, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: 'lunch,snack', price_range: 'Economy|100-300', crowd_label: 'Medium-High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT029', name: 'Cairo Tower', city: 'Cairo', district: 'Zamalek', latitude: 30.0296, longitude: 31.2328, address: 'Zamalek Island', categories: 'outdoor,viewpoint', sub_type: 'Tower', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 120, avg_rating: 4.1, popularity: 0.78, total_reviews: 2200, open_hour: 9, close_hour: 23, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner,snack', price_range: 'Economy|100-200', crowd_label: 'Medium-High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT030', name: 'Gezira Island', city: 'Cairo', district: 'Zamalek', latitude: 30.0300, longitude: 31.2350, address: 'Gezira', categories: 'outdoor,park', sub_type: 'Island', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.2, popularity: 0.75, total_reviews: 1900, open_hour: 8, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner,snack', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT031', name: 'Aquarium Grotto', city: 'Cairo', district: 'Zamalek', latitude: 30.0290, longitude: 31.2330, address: 'Gezira Island', categories: 'outdoor,family,park', sub_type: 'Park Attraction', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 20, avg_rating: 3.7, popularity: 0.55, total_reviews: 800, open_hour: 10, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'snack', price_range: 'Economy|20-100', crowd_label: 'Medium', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT032', name: 'Opera House', city: 'Cairo', district: 'Zamalek', latitude: 30.0298, longitude: 31.2335, address: 'Gezira Island', categories: 'cultural,entertainment', sub_type: 'Theater', is_outdoor: 0, avg_visit_hrs: 2, admission_egp: 150, avg_rating: 4.5, popularity: 0.78, total_reviews: 1700, open_hour: 16, close_hour: 23, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'dinner,snack', price_range: 'Premium|100-300', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT033', name: 'Downtown Cafe District', city: 'Cairo', district: 'Downtown', latitude: 30.0400, longitude: 31.2400, address: 'Downtown Cairo', categories: 'cafe,restaurant,cultural', sub_type: 'District', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.3, popularity: 0.82, total_reviews: 2100, open_hour: 10, close_hour: 23, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT034', name: 'Saqqara Pyramid Complex', city: 'Giza', district: 'Saqqara', latitude: 29.8752, longitude: 31.2197, address: 'Saqqara', categories: 'historical,ancient', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 150, avg_rating: 4.6, popularity: 0.85, total_reviews: 3000, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT035', name: 'Dahshur Pyramids', city: 'Giza', district: 'Dahshur', latitude: 29.7939, longitude: 31.2089, address: 'Dahshur', categories: 'historical,ancient', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 120, avg_rating: 4.5, popularity: 0.72, total_reviews: 1700, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT036', name: 'Abusir Pyramids', city: 'Giza', district: 'Abusir', latitude: 29.9072, longitude: 31.2038, address: 'Abusir', categories: 'historical,ancient', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.3, popularity: 0.65, total_reviews: 1400, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: '', price_range: 'Economy|100-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT037', name: 'Memphis Open Air Museum', city: 'Giza', district: 'Mi Rahina', latitude: 29.8436, longitude: 31.2596, address: 'Mi Rahina', categories: 'museum,historical,ancient', sub_type: 'Museum', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 100, avg_rating: 4.4, popularity: 0.73, total_reviews: 1600, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|100-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT038', name: 'Edfu Temple', city: 'Aswan', district: 'Edfu', latitude: 24.9724, longitude: 32.8812, address: 'Edfu', categories: 'historical,ancient,temple', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 150, avg_rating: 4.7, popularity: 0.88, total_reviews: 2500, open_hour: 9, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'High', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT039', name: 'Karnak Temple Complex', city: 'Luxor', district: 'Karnak', latitude: 25.7174, longitude: 32.6560, address: 'Karnak', categories: 'historical,ancient,temple', sub_type: 'Temple Complex', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 140, avg_rating: 4.8, popularity: 0.95, total_reviews: 4800, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT040', name: 'Luxor Temple', city: 'Luxor', district: 'Downtown', latitude: 25.6970, longitude: 32.6390, address: 'Luxor', categories: 'historical,ancient,temple', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 100, avg_rating: 4.7, popularity: 0.92, total_reviews: 4200, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|100-150', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT041', name: 'Valley of the Kings', city: 'Luxor', district: 'West Bank', latitude: 25.7404, longitude: 32.6048, address: 'West Bank', categories: 'historical,ancient', sub_type: 'Archaeological Complex', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 200, avg_rating: 4.8, popularity: 0.93, total_reviews: 4500, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch', price_range: 'Premium|200-300', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT042', name: 'Mortuary Temple of Hatshepsut', city: 'Luxor', district: 'West Bank', latitude: 25.7391, longitude: 32.6083, address: 'West Bank', categories: 'historical,ancient,temple', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 120, avg_rating: 4.8, popularity: 0.90, total_reviews: 3500, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|100-200', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT043', name: 'Colossi of Memnon', city: 'Luxor', district: 'West Bank', latitude: 25.7331, longitude: 32.6173, address: 'West Bank', categories: 'historical,ancient,monument', sub_type: 'Monument', is_outdoor: 1, avg_visit_hrs: 0.5, admission_egp: 0, avg_rating: 4.3, popularity: 0.72, total_reviews: 1800, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT044', name: 'Aswan High Dam', city: 'Aswan', district: 'Aswan', latitude: 23.9698, longitude: 32.8794, address: 'Aswan', categories: 'historical,modern,outdoor', sub_type: 'Dam', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 40, avg_rating: 4.1, popularity: 0.73, total_reviews: 1700, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|30-100', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT045', name: 'Philae Temple', city: 'Aswan', district: 'Philae', latitude: 24.0165, longitude: 32.8860, address: 'Philae Island', categories: 'historical,ancient,temple', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 180, avg_rating: 4.7, popularity: 0.88, total_reviews: 3200, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|150-250', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT046', name: 'Nubian Museum', city: 'Aswan', district: 'Downtown', latitude: 23.9680, longitude: 32.8816, address: 'Sharia Youssef Al-Guindy', categories: 'museum,cultural,historical', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 2.5, admission_egp: 150, avg_rating: 4.5, popularity: 0.72, total_reviews: 1500, open_hour: 10, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|100-200', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT047', name: 'Abu Simbel Temples', city: 'Abu Simbel', district: 'Abu Simbel', latitude: 22.3452, longitude: 31.6089, address: 'Abu Simbel', categories: 'historical,ancient,temple', sub_type: 'Temple', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 4.9, popularity: 0.92, total_reviews: 2800, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch', price_range: 'Premium|200-400', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT048', name: 'Khan Misr Tulun', city: 'Cairo', district: 'Old Cairo', latitude: 30.0043, longitude: 31.2408, address: 'Shar al-Sayyida', categories: 'historical,shopping,cultural', sub_type: 'Historic Street', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.2, popularity: 0.68, total_reviews: 1400, open_hour: 10, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|30-150', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT049', name: 'Alexandria Corniche', city: 'Alexandria', district: 'Downtown', latitude: 31.2945, longitude: 29.9550, address: 'Corniche', categories: 'beach,coastal,outdoor,restaurant', sub_type: 'Waterfront', is_outdoor: 1, avg_visit_hrs: 2.5, admission_egp: 0, avg_rating: 4.4, popularity: 0.92, total_reviews: 4100, open_hour: 9, close_hour: 23, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|50-300', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT050', name: 'Bibliotheca Alexandrina', city: 'Alexandria', district: 'Downtown', latitude: 31.2945, longitude: 29.9545, address: 'Corniche', categories: 'cultural,museum,modern', sub_type: 'Library Museum', is_outdoor: 0, avg_visit_hrs: 2.5, admission_egp: 200, avg_rating: 4.6, popularity: 0.82, total_reviews: 2300, open_hour: 9, close_hour: 19, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,coffee', price_range: 'Economy|150-250', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT051', name: 'Al-Fishawy Café', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0609, longitude: 31.2535, address: 'Khan el-Khalili', categories: 'cafe,restaurant,cultural', sub_type: 'Historic Café', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 0, avg_rating: 4.5, popularity: 0.88, total_reviews: 3200, open_hour: 10, close_hour: 23, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|20-100', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT052', name: 'Umm Kulthum House Museum', city: 'Cairo', district: 'Zamalek', latitude: 30.0268, longitude: 31.2360, address: 'Zamalek Island', categories: 'museum,cultural,historical', sub_type: 'House Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 100, avg_rating: 4.3, popularity: 0.60, total_reviews: 1100, open_hour: 10, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT053', name: 'Abd El-Rahim Sabry Museum', city: 'Cairo', district: 'Zamalek', latitude: 30.0270, longitude: 31.2365, address: 'Zamalek Island', categories: 'museum,cultural,historical', sub_type: 'House Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.2, popularity: 0.55, total_reviews: 950, open_hour: 10, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT054', name: 'Sohrag Museum', city: 'Cairo', district: 'Zamalek', latitude: 30.0258, longitude: 31.2355, address: 'Zamalek Island', categories: 'museum,cultural', sub_type: 'Art Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.1, popularity: 0.50, total_reviews: 850, open_hour: 10, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|50-100', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT055', name: 'Nile Barage', city: 'Cairo', district: 'Zamalek', latitude: 30.0670, longitude: 31.1000, address: 'Zamalek', categories: 'outdoor,park,botanical', sub_type: 'Garden', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 20, avg_rating: 4.0, popularity: 0.65, total_reviews: 1300, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch,snack', price_range: 'Economy|20-100', crowd_label: 'Medium', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT056', name: 'Al-Azbekeya Gardens', city: 'Cairo', district: 'Downtown', latitude: 30.0380, longitude: 31.2400, address: 'Downtown Cairo', categories: 'outdoor,park', sub_type: 'Park', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 10, avg_rating: 3.8, popularity: 0.60, total_reviews: 1100, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,snack', price_range: 'Economy|10-100', crowd_label: 'Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT057', name: 'Andalusian Garden', city: 'Cairo', district: 'Zamalek', latitude: 30.0320, longitude: 31.2340, address: 'Gezira Island', categories: 'outdoor,park', sub_type: 'Park', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 15, avg_rating: 3.9, popularity: 0.62, total_reviews: 1200, open_hour: 9, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'snack', price_range: 'Economy|15-100', crowd_label: 'Medium', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT058', name: 'Silvester Park', city: 'Cairo', district: 'Downtown', latitude: 30.0390, longitude: 31.2380, address: 'Downtown Cairo', categories: 'outdoor,park', sub_type: 'Park', is_outdoor: 1, avg_visit_hrs: 1, admission_egp: 0, avg_rating: 3.7, popularity: 0.55, total_reviews: 950, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT059', name: 'Amir Taz Palace', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0580, longitude: 31.2490, address: 'Islamic Cairo', categories: 'historical,cultural,museum', sub_type: 'Palace Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 80, avg_rating: 4.2, popularity: 0.58, total_reviews: 1050, open_hour: 10, close_hour: 16, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|50-150', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT060', name: 'Mausoleum of Sultan Barquq', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0625, longitude: 31.2545, address: 'Islamic Cairo', categories: 'historical,religious,cultural', sub_type: 'Mausoleum', is_outdoor: 1, avg_visit_hrs: 1, admission_egp: 10, avg_rating: 4.1, popularity: 0.52, total_reviews: 950, open_hour: 9, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT061', name: 'School of Sultan al-Nasir Muhammad', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0615, longitude: 31.2520, address: 'Islamic Cairo', categories: 'historical,cultural', sub_type: 'Historic Building', is_outdoor: 0, avg_visit_hrs: 1, admission_egp: 15, avg_rating: 4.0, popularity: 0.50, total_reviews: 850, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT062', name: 'Bab Zuweila Gate', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0530, longitude: 31.2480, address: 'Islamic Cairo', categories: 'historical,ancient', sub_type: 'Gate', is_outdoor: 1, avg_visit_hrs: 1, admission_egp: 20, avg_rating: 4.1, popularity: 0.62, total_reviews: 1150, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT063', name: 'Ibn Tulun Mosque', city: 'Cairo', district: 'Old Cairo', latitude: 30.0256, longitude: 31.2434, address: 'Ibn Tulun', categories: 'religious,historical,cultural', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 20, avg_rating: 4.3, popularity: 0.70, total_reviews: 1550, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|0-50', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT064', name: 'Muhammad Ali Mosque', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', categories: 'religious,historical,cultural', sub_type: 'Mosque', is_outdoor: 0, avg_visit_hrs: 2, admission_egp: 30, avg_rating: 4.6, popularity: 0.88, total_reviews: 2700, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|0-100', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT065', name: 'Military Museum', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', categories: 'museum,historical,cultural', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 2, admission_egp: 50, avg_rating: 4.2, popularity: 0.68, total_reviews: 1450, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: 'lunch', price_range: 'Economy|50-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT066', name: 'Carriage Museum', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', categories: 'museum,historical', sub_type: 'Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 40, avg_rating: 4.1, popularity: 0.60, total_reviews: 1200, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|30-100', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT067', name: 'Al-Gawhara Palace', city: 'Cairo', district: 'Islamic Cairo', latitude: 30.0291, longitude: 31.2629, address: 'Citadel', categories: 'museum,historical,cultural', sub_type: 'Palace Museum', is_outdoor: 0, avg_visit_hrs: 1.5, admission_egp: 60, avg_rating: 4.2, popularity: 0.62, total_reviews: 1250, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 1, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|50-100', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT068', name: 'Suez Canal', city: 'Ismailia', district: 'Suez', latitude: 30.5891, longitude: 32.2663, address: 'Suez', categories: 'historical,modern,outdoor', sub_type: 'Waterway', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.2, popularity: 0.70, total_reviews: 1400, open_hour: 9, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch', price_range: 'Economy|0-100', crowd_label: 'Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT069', name: 'Wadi El-Rayan Protected Area', city: 'Fayoum', district: 'Fayoum', latitude: 29.3800, longitude: 30.5400, address: 'Fayoum', categories: 'outdoor,nature', sub_type: 'Nature Reserve', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 50, avg_rating: 4.3, popularity: 0.72, total_reviews: 1600, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch,snack', price_range: 'Economy|30-150', crowd_label: 'Low-Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT070', name: 'Lake Qarun', city: 'Fayoum', district: 'Fayoum', latitude: 29.4500, longitude: 30.7500, address: 'Fayoum', categories: 'beach,outdoor,restaurant', sub_type: 'Lake', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 30, avg_rating: 4.2, popularity: 0.70, total_reviews: 1450, open_hour: 8, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch,dinner,snack', price_range: 'Economy|30-200', crowd_label: 'Medium-High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT071', name: 'Sharm El-Sheikh', city: 'South Sinai', district: 'Sharm', latitude: 27.8660, longitude: 34.3391, address: 'Sharm El-Sheikh', categories: 'beach,coastal,outdoor,restaurant', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 0, avg_rating: 4.5, popularity: 0.92, total_reviews: 4500, open_hour: 24, close_hour: 24, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Premium|100-500', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT072', name: 'Ras Mohammed National Park', city: 'South Sinai', district: 'Sharm', latitude: 27.7372, longitude: 34.2756, address: 'Ras Mohammed', categories: 'beach,outdoor,nature', sub_type: 'National Park', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 100, avg_rating: 4.6, popularity: 0.85, total_reviews: 2300, open_hour: 8, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch', price_range: 'Economy|100-250', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT073', name: 'Dahab', city: 'South Sinai', district: 'Dahab', latitude: 28.5033, longitude: 34.5200, address: 'Dahab', categories: 'beach,coastal,outdoor', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 0, avg_rating: 4.4, popularity: 0.80, total_reviews: 2200, open_hour: 24, close_hour: 24, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Economy|50-300', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT074', name: 'Hurghada', city: 'Red Sea', district: 'Hurghada', latitude: 27.2564, longitude: 33.8136, address: 'Hurghada', categories: 'beach,coastal,outdoor,restaurant', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 0, avg_rating: 4.6, popularity: 0.93, total_reviews: 4700, open_hour: 24, close_hour: 24, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'breakfast,lunch,coffee,dinner', price_range: 'Premium|100-500', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT075', name: 'Mahmya Island', city: 'Red Sea', district: 'Hurghada', latitude: 27.3500, longitude: 33.7500, address: 'Red Sea', categories: 'beach,coastal,outdoor', sub_type: 'Island', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 200, avg_rating: 4.5, popularity: 0.78, total_reviews: 1800, open_hour: 8, close_hour: 18, pedestrian_friendly: 0, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch,snack', price_range: 'Premium|150-400', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT076', name: 'Giftun Island', city: 'Red Sea', district: 'Hurghada', latitude: 27.3000, longitude: 33.8000, address: 'Red Sea', categories: 'beach,coastal,outdoor', sub_type: 'Island', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 150, avg_rating: 4.4, popularity: 0.75, total_reviews: 1700, open_hour: 8, close_hour: 18, pedestrian_friendly: 0, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch', price_range: 'Premium|100-350', crowd_label: 'High', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT077', name: 'Sidi Abdel Rahman Beach', city: 'North Coast', district: 'Alamein', latitude: 30.8333, longitude: 28.5500, address: 'Alamein', categories: 'beach,coastal,outdoor', sub_type: 'Beach', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 30, avg_rating: 4.3, popularity: 0.75, total_reviews: 1800, open_hour: 8, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT078', name: 'Marsa Matrouh', city: 'Matrouh', district: 'Matrouh', latitude: 31.3537, longitude: 27.2374, address: 'Matrouh', categories: 'beach,coastal,outdoor,restaurant', sub_type: 'Beach Resort', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 20, avg_rating: 4.2, popularity: 0.70, total_reviews: 1500, open_hour: 9, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Yes', meal_slot: 'lunch,dinner', price_range: 'Economy|30-200', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT079', name: 'Alamein World War Cemetery', city: 'North Coast', district: 'Alamein', latitude: 30.8233, longitude: 28.5383, address: 'Alamein', categories: 'historical,cultural', sub_type: 'Cemetery', is_outdoor: 1, avg_visit_hrs: 1.5, admission_egp: 50, avg_rating: 4.4, popularity: 0.68, total_reviews: 1300, open_hour: 9, close_hour: 17, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: '', price_range: 'Economy|50-100', crowd_label: 'Low-Medium', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT080', name: 'Siwa Oasis', city: 'New Valley', district: 'Siwa', latitude: 29.2029, longitude: 25.5164, address: 'Siwa', categories: 'beach,outdor,nature', sub_type: 'Oasis', is_outdoor: 1, avg_visit_hrs: 5, admission_egp: 100, avg_rating: 4.5, popularity: 0.75, total_reviews: 1600, open_hour: 8, close_hour: 19, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch,dinner', price_range: 'Premium|100-300', crowd_label: 'Low-Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT081', name: 'White Desert', city: 'New Valley', district: 'Farafra', latitude: 27.8200, longitude: 29.5500, address: 'Farafra', categories: 'outdoor,nature', sub_type: 'Nature Reserve', is_outdoor: 1, avg_visit_hrs: 4, admission_egp: 80, avg_rating: 4.5, popularity: 0.72, total_reviews: 1500, open_hour: 8, close_hour: 18, pedestrian_friendly: 0, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch,dinner', price_range: 'Premium|100-250', crowd_label: 'Low-Medium', crowd_pattern: 'weekday,weekend' },
  { attraction_id: 'ATT082', name: 'Black Desert', city: 'New Valley', district: 'Bahariyya', latitude: 28.3500, longitude: 29.5000, address: 'Bahariyya', categories: 'outdoor,nature', sub_type: 'Nature Reserve', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 60, avg_rating: 4.3, popularity: 0.65, total_reviews: 1300, open_hour: 8, close_hour: 18, pedestrian_friendly: 0, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'No', meal_slot: 'lunch,dinner', price_range: 'Premium|100-200', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT083', name: 'Baharia Oasis', city: 'New Valley', district: 'Bahariyya', latitude: 28.3700, longitude: 29.5200, address: 'Bahariyya', categories: 'outdoor,nature,cultural', sub_type: 'Oasis', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 50, avg_rating: 4.2, popularity: 0.60, total_reviews: 1200, open_hour: 8, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 0, metro_bus_nearby: 0, walking_friendly: 'Partial', meal_slot: 'lunch,dinner', price_range: 'Economy|50-200', crowd_label: 'Low', crowd_pattern: 'weekday' },
  { attraction_id: 'ATT084', name: 'Mandara Beach', city: 'Alexandria', district: 'Mandara', latitude: 31.2607, longitude: 30.0319, address: 'Mandara, Alexandria', categories: 'beach,outdoor,coastal,nature', sub_type: 'Public Beach', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 20, avg_rating: 4.0, popularity: 0.56, total_reviews: 1200, open_hour: 9, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner,snack', price_range: 'Economy|20-100', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT085', name: 'Haramosis Beach', city: 'Alexandria', district: 'Agami', latitude: 31.1025, longitude: 29.7321, address: 'Agami, Alexandria', categories: 'beach,outdoor,coastal,nature', sub_type: 'Public Beach', is_outdoor: 1, avg_visit_hrs: 3.5, admission_egp: 0, avg_rating: 3.8, popularity: 0.58, total_reviews: 1800, open_hour: 9, close_hour: 18, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner', price_range: 'Economy|20-100', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT086', name: 'Abu Qir Bay Seafront', city: 'Alexandria', district: 'Abu Qir', latitude: 31.3100, longitude: 30.0019, address: 'Abu Qir, Alexandria', categories: 'beach,outdoor,coastal,nature,historical', sub_type: 'Bay Seafront', is_outdoor: 1, avg_visit_hrs: 2, admission_egp: 0, avg_rating: 4.2, popularity: 0.50, total_reviews: 2100, open_hour: 9, close_hour: 24, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner,snack', price_range: 'Economy|0-100', crowd_label: 'High', crowd_pattern: 'weekend' },
  { attraction_id: 'ATT087', name: 'Mamoura Beach', city: 'Alexandria', district: 'Mamoura', latitude: 31.2881, longitude: 30.0171, address: 'Mamoura Palace Area, Alexandria', categories: 'beach,coastal,park,nature', sub_type: 'Private Beach', is_outdoor: 1, avg_visit_hrs: 3, admission_egp: 30, avg_rating: 4.4, popularity: 0.08, total_reviews: 4500, open_hour: 9, close_hour: 20, pedestrian_friendly: 1, walkable_cluster: 1, metro_bus_nearby: 1, walking_friendly: 'Yes', meal_slot: 'lunch,dinner,snack', price_range: 'Economy|30-150', crowd_label: 'Very High', crowd_pattern: 'weekday,weekend' }
];

async function initializeDatabase() {
  try {
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
        home_country VARCHAR(100),
        tourist_type VARCHAR(50),
        preferred_categories VARCHAR(500),
        disliked_categories VARCHAR(500),
        accessibility_needs VARCHAR(255),
        budget_egp INTEGER,
        available_hour INTEGER,
        liked_attraction_ids VARCHAR(500),
        visited_attraction_ids VARCHAR(500),
        eco_points INTEGER,
        sustainability_level VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create attractions table
    const createAttractionsTableQuery = `
      CREATE TABLE IF NOT EXISTS attractions (
        attraction_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        district VARCHAR(100),
        latitude DECIMAL(10, 4),
        longitude DECIMAL(10, 4),
        address TEXT,
        categories VARCHAR(500),
        sub_type VARCHAR(100),
        is_outdoor INTEGER,
        avg_visit_hrs DECIMAL(3, 1),
        admission_egp INTEGER,
        avg_rating DECIMAL(3, 1),
        popularity DECIMAL(3, 2),
        total_reviews INTEGER,
        open_hour INTEGER,
        close_hour INTEGER,
        pedestrian_friendly INTEGER,
        walkable_cluster INTEGER,
        metro_bus_nearby INTEGER,
        walking_friendly VARCHAR(50),
        meal_slot VARCHAR(200),
        price_range VARCHAR(100),
        crowd_label VARCHAR(50),
        crowd_pattern VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createUsersTableQuery);
    console.log('✓ Users table created/verified');

    await pool.query(createAttractionsTableQuery);
    console.log('✓ Attractions table created/verified');

    // Insert users data
    const insertUserQuery = `
      INSERT INTO users (
        user_id, name, email, password, language, current_city, home_country, 
        tourist_type, preferred_categories, disliked_categories, 
        accessibility_needs, budget_egp, available_hour, 
        liked_attraction_ids, visited_attraction_ids, 
        eco_points, sustainability_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        user.home_country,
        user.tourist_type,
        user.preferred_categories,
        user.disliked_categories,
        user.accessibility_needs,
        user.budget_egp,
        user.available_hour,
        user.liked_attraction_ids,
        user.visited_attraction_ids,
        user.eco_points,
        user.sustainability_level
      ]);
    }

    console.log('✓ Inserted ' + usersData.length + ' users into database');

    // Insert attractions data
    const insertAttractionQuery = `
      INSERT INTO attractions (
        attraction_id, name, city, district, latitude, longitude, address, 
        categories, sub_type, is_outdoor, avg_visit_hrs, admission_egp, 
        avg_rating, popularity, total_reviews, open_hour, close_hour, 
        pedestrian_friendly, walkable_cluster, metro_bus_nearby, 
        walking_friendly, meal_slot, price_range, crowd_label, crowd_pattern
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (attraction_id) DO NOTHING;
    `;

    for (const attraction of attractionsData) {
      await pool.query(insertAttractionQuery, [
        attraction.attraction_id,
        attraction.name,
        attraction.city,
        attraction.district,
        attraction.latitude,
        attraction.longitude,
        attraction.address,
        attraction.categories,
        attraction.sub_type,
        attraction.is_outdoor,
        attraction.avg_visit_hrs,
        attraction.admission_egp,
        attraction.avg_rating,
        attraction.popularity,
        attraction.total_reviews,
        attraction.open_hour,
        attraction.close_hour,
        attraction.pedestrian_friendly,
        attraction.walkable_cluster,
        attraction.metro_bus_nearby,
        attraction.walking_friendly,
        attraction.meal_slot,
        attraction.price_range,
        attraction.crowd_label,
        attraction.crowd_pattern
      ]);
    }

    console.log('✓ Inserted ' + attractionsData.length + ' attractions into database');

    // Verify the data
    const usersResult = await pool.query('SELECT COUNT(*) FROM users;');
    const attractionsResult = await pool.query('SELECT COUNT(*) FROM attractions;');
    console.log('✓ Total users in database:', usersResult.rows[0].count);
    console.log('✓ Total attractions in database:', attractionsResult.rows[0].count);

    console.log('\n✓ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();
