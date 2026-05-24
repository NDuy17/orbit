import { Platform } from 'react-native';

export function blurActiveWebElement() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
}
