import { useEffect } from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';
import { FragmentMono_400Regular } from '@expo-google-fonts/fragment-mono';
import { color_pallet } from '@/styles/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: color_pallet.bg.DEFAULT,
    card: color_pallet.bg.DEFAULT,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    FragmentMono_400Regular,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={AppTheme}>
      <View style={{ flex: 1, backgroundColor: color_pallet.bg.DEFAULT }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </ThemeProvider>
  );
}
