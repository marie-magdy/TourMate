// constants/types.ts

export interface Attraction {
  id: number;
  name: string;
  city: string;
  city_name?: string;
  categories?: string[];    // DB array from attraction_categories join
  category?: string;        // legacy single-category field (may be absent)
  description: string;
  image_url?: string;
  primary_image: string;
  rating: number;
  review_count?: number;
  price_from: number;
  opening_hours?: string;   // DB column: opening hours string
  is_popular?: boolean;
  latitude?: number;
  longitude?: number;
  virtual_tour_url?: string | null;
}