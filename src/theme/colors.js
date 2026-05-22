import { Platform } from 'react-native';

export const themePalettes = {
  dark: {
    background: '#0B1020',
    backgroundSoft: '#111827',
    card: 'rgba(30, 41, 59, 0.78)',
    cardStrong: '#172033',
    primary: '#8B5CF6',
    primarySoft: 'rgba(139, 92, 246, 0.18)',
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.14)',
    text: '#F1F5F9',
    muted: '#A7B4C8',
    line: 'rgba(203, 213, 225, 0.16)',
    online: '#22C55E',
    offline: '#64748B',
    danger: '#F87171',
    white: '#FFFFFF',
    black: '#000000',
  },
  light: {
    background: '#FFF9F0',
    backgroundSoft: '#FFEFD6',
    card: 'rgba(255, 255, 255, 0.94)',
    cardStrong: '#FFFFFF',
    primary: '#F97316',
    primarySoft: 'rgba(249, 115, 22, 0.16)',
    accent: '#0284C7',
    accentSoft: 'rgba(2, 132, 199, 0.12)',
    text: '#1F2937',
    muted: '#667085',
    line: 'rgba(31, 41, 55, 0.14)',
    online: '#16A34A',
    offline: '#94A3B8',
    danger: '#DC2626',
    white: '#FFFFFF',
    black: '#000000',
  },
};

let currentThemeName = 'dark';

function cssVarName(key) {
  return `--orbit-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

export function applyTheme(themeName) {
  currentThemeName = themePalettes[themeName] ? themeName : 'dark';
  const palette = themePalettes[currentThemeName];
  Object.assign(colors, Platform.OS === 'web' ? getWebColors() : palette);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(cssVarName(key), value);
    });
  }
}

export function getCurrentThemeName() {
  return currentThemeName;
}

function getWebColors() {
  return Object.keys(themePalettes.dark).reduce((items, key) => {
    items[key] = `var(${cssVarName(key)})`;
    return items;
  }, {});
}

const colors = Platform.OS === 'web' ? getWebColors() : { ...themePalettes.dark };

applyTheme(currentThemeName);

export default colors;
