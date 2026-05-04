import { create } from 'zustand';

export type Hotel = {
  id: number;
  name: string;
  city: string;
  image_url?: string;
  price_per_night?: number;
};

type BookingStore = {
  selectedHotel: Hotel | null;
  selectedFlight: any | null;

  setSelectedHotel: (hotel: Hotel) => void;
  setSelectedFlight: (flight: any) => void;
};

export const useBookingStore = create<BookingStore>((set) => ({
  selectedHotel: null,
  selectedFlight: null,

  setSelectedHotel: (hotel) => set({ selectedHotel: hotel }),
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),
}));