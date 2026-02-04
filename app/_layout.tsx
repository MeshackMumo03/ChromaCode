import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { HistoryProvider } from '@/hooks/useHistory';
import { SettingsProvider } from '@/hooks/useSettings';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isLoading, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    // Optionally render a loading screen
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', title: 'Profile' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <HistoryProvider>
        <SettingsProvider>
          <RootLayoutNav />
        </SettingsProvider>
      </HistoryProvider>
    </AuthProvider>
  );
}