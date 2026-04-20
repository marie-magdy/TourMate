// constants/types.ts

export interface Attraction {
  id: number;
  name: string;
  city: string;
  city_name?: string;      // ← also add this
  categories?: string[];   // ← add this
  category?: string;       // ← change to optional
  description: string;
  image_url: string;
  rating: number;
  price_from: number;
  opening_hours?: string;
  is_popular?: boolean;
  latitude?: number;
  longitude?: number;
  virtual_tour_url?: string | null;
}