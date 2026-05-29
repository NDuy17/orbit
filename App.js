import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import useThemeStore from './src/store/themeStore';

export default function App() {
  const themeName = useThemeStore((state) => state.themeName);

  return (
    <>
      <StatusBar style={themeName === 'light' ? 'dark' : 'light'} />
      <AppNavigator />
    </>
  );
}
