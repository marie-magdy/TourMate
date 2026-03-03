// constants/types.ts

export interface Attraction {
  id: number;
  name: string;
  description: string;
  location: string;
  city: string;
  country: string;
  category: string;
  price_from: number;
  rating: number;
  review_count: number;
  image_url: string;
  latitude: number;
  longitude: number;
  is_featured: boolean;
}