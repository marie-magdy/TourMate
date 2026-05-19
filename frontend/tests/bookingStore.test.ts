import { useBookingStore, Hotel, Flight } from '../store/bookingStore';

const reset = () =>
  useBookingStore.setState({ selectedHotel: null, selectedFlight: null });

beforeEach(reset);

const sampleHotel: Hotel = {
  id: 1,
  name: 'Marriott',
  city: 'Cairo',
  price_per_night: 200,
  stars: 5,
};

const sampleFlight: Flight = {
  airline: 'EgyptAir',
  flightNumber: 'MS785',
  departure: 'JFK',
  arrival: 'CAI',
  departureTime: '08:00',
  arrivalTime: '20:00',
  duration: '12h',
  class: 'economy',
  price: 800,
};


describe('bookingStore', () => {

  it('starts with selectedHotel=null and selectedFlight=null', () => {
    const s = useBookingStore.getState();
    expect(s.selectedHotel).toBeNull();
    expect(s.selectedFlight).toBeNull();
  });

  it('setSelectedHotel updates selectedHotel', () => {
    useBookingStore.getState().setSelectedHotel(sampleHotel);
    expect(useBookingStore.getState().selectedHotel).toEqual(sampleHotel);
  });

  it('setSelectedFlight updates selectedFlight', () => {
    useBookingStore.getState().setSelectedFlight(sampleFlight);
    expect(useBookingStore.getState().selectedFlight).toEqual(sampleFlight);
  });

  it('updateHotelBookingUrl is a no-op when selectedHotel is null', () => {
    useBookingStore.getState().updateHotelBookingUrl('https://x');
    expect(useBookingStore.getState().selectedHotel).toBeNull();
  });

  it('updateHotelBookingUrl spreads existing hotel and adds bookingUrl', () => {
    useBookingStore.getState().setSelectedHotel(sampleHotel);
    useBookingStore.getState().updateHotelBookingUrl('https://booking/x');
    const updated = useBookingStore.getState().selectedHotel!;
    expect(updated.bookingUrl).toBe('https://booking/x');
    // All original fields preserved
    expect(updated.id).toBe(1);
    expect(updated.name).toBe('Marriott');
    expect(updated.stars).toBe(5);
  });

  it('updateHotelBookingUrl returns a new object reference (immutable update)', () => {
    useBookingStore.getState().setSelectedHotel(sampleHotel);
    const before = useBookingStore.getState().selectedHotel;
    useBookingStore.getState().updateHotelBookingUrl('https://booking/x');
    const after = useBookingStore.getState().selectedHotel;
    expect(after).not.toBe(before);
  });

  it('updateFlightBookingUrl is a no-op when selectedFlight is null', () => {
    useBookingStore.getState().updateFlightBookingUrl('https://x');
    expect(useBookingStore.getState().selectedFlight).toBeNull();
  });

  it('updateFlightBookingUrl spreads existing flight and adds bookingUrl', () => {
    useBookingStore.getState().setSelectedFlight(sampleFlight);
    useBookingStore.getState().updateFlightBookingUrl('https://book/flight');
    const updated = useBookingStore.getState().selectedFlight!;
    expect(updated.bookingUrl).toBe('https://book/flight');
    expect(updated.airline).toBe('EgyptAir');
    expect(updated.flightNumber).toBe('MS785');
  });

  it('notifies subscribers when state changes', () => {
    const listener = jest.fn();
    const unsubscribe = useBookingStore.subscribe(listener);
    useBookingStore.getState().setSelectedHotel(sampleHotel);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('setSelectedHotel does not touch selectedFlight', () => {
    useBookingStore.getState().setSelectedFlight(sampleFlight);
    useBookingStore.getState().setSelectedHotel(sampleHotel);
    expect(useBookingStore.getState().selectedFlight).toEqual(sampleFlight);
  });
});
