import { create } from 'zustand';
import { currentLocation } from '../data/mockLocations';

const useLocationStore = create((set) => ({
  currentLocation,
  radius: 500,
  ghostMode: false,
  approximateLocation: true,
  locationLoading: false,
  locationError: null,
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setRadius: (radius) => set({ radius }),
  toggleGhostMode: () => set((state) => ({ ghostMode: !state.ghostMode })),
  toggleApproximateLocation: () =>
    set((state) => ({ approximateLocation: !state.approximateLocation })),
  setLocationLoading: (locationLoading) => set({ locationLoading }),
  setLocationError: (locationError) => set({ locationError }),
}));

export default useLocationStore;
