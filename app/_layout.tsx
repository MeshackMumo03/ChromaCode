import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';


import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { HistoryProvider } from '@/hooks/useHistory';
import { SettingsProvider } from '@/hooks/useSettings';
import { CodesProvider } from '@/hooks/useCodes'; 
import { useNotifications } from '@/hooks/useNotifications';
import { SocketProvider } from '@/hooks/useSocket';

export const unstable_settings = {
  anchor: '(tabs)',
};

import Constants from 'expo-constants';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLoading, token } = useAuth();
  const router = useRouter();
  
  // Initialize notifications ONLY if not in Expo Go
  useEffect(() => {
    if (Constants.appOwnership !== 'expo') {
      // Logic would go here if we didn't use a hook, 
      // but since we do, we'll let the hook handle its own internal check.
    }
  }, []);
  
  useNotifications();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return null;
  }

  return (
    <SocketProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SocketProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <HistoryProvider>
        <SettingsProvider>
          <CodesProvider>
            <RootLayoutNav />
          </CodesProvider>
        </SettingsProvider>
      </HistoryProvider>
    </AuthProvider>
  );
}