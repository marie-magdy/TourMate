import { create } from 'zustand';

export type Hotel = {
  id: number;
  name: string;
  city: string;
  image_url?: string;
  price_per_night?: number;
  stars?: number;
  rating?: number;
  bookingUrl?: string;
  checkIn?: string;
  checkOut?: string;
};

export type Flight = {
  
  airline: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  class: string;
  price: number;
  bookingUrl?: string;  // ← add
};

type BookingStore = {
  selectedHotel: Hotel | null;
  selectedFlight: Flight | null;  // ← typed now

  setSelectedHotel: (hotel: Hotel) => void;
  setSelectedFlight: (flight: Flight) => void;

  updateHotelBookingUrl: (url: string) => void;   // ← add for editable
  updateFlightBookingUrl: (url: string) => void;  // ← add for editable
};

export const useBookingStore = create<BookingStore>((set) => ({
  selectedHotel: null,
  selectedFlight: null,

  setSelectedHotel: (hotel) => set({ selectedHotel: hotel }),
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),

  updateHotelBookingUrl: (url) =>
    set((state) => ({
      selectedHotel: state.selectedHotel ? { ...state.selectedHotel, bookingUrl: url } : null,
    })),

  updateFlightBookingUrl: (url) =>
    set((state) => ({
      selectedFlight: state.selectedFlight ? { ...state.selectedFlight, bookingUrl: url } : null,
    })),
}));