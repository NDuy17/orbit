import { create } from 'zustand';
import { applyTheme, getCurrentThemeName } from '../theme/colors';

const useThemeStore = create((set) => ({
  themeName: getCurrentThemeName(),
  setThemeName: (themeName) => {
    applyTheme(themeName);
    set({ themeName });
  },
}));

export default useThemeStore;
