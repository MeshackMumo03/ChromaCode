import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we initialize
SplashScreen.preventAutoHideAsync();

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { HistoryProvider } from '@/hooks/useHistory';
import { SettingsProvider } from '@/hooks/useSettings';
import { CodesProvider } from '@/hooks/useCodes'; 
import { useNotifications } from '@/hooks/useNotifications';
import { SocketProvider } from '@/hooks/useSocket';
import { ConversationsProvider } from '@/hooks/useConversations';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLoading, isInitializing, token } = useAuth();
  const router = useRouter();
  
  useNotifications();

  // Maintenance: Clear bloated cache from previous versions if needed
  useEffect(() => {
    const clearBloatedCache = async () => {
      try {
        const hasCleaned = await AsyncStorage.getItem('chromacode_cache_cleaned_v2');
        if (!hasCleaned) {
          console.log('--- Maintenance: Purging old AsyncStorage cache ---');
          const keys = await AsyncStorage.getAllKeys();
          const chatKeys = keys.filter(key => key.startsWith('chromacode_chat_') || key === 'chromacode_cache_conversations');
          if (chatKeys.length > 0) {
            await AsyncStorage.multiRemove(chatKeys);
          }
          await AsyncStorage.setItem('chromacode_cache_cleaned_v2', 'true');
          console.log('--- Maintenance: Cache purged successfully ---');
        }
      } catch (e) {
        console.error('Failed to clear bloated cache:', e);
      }
    };
    clearBloatedCache();
  }, []);

  useEffect(() => {
    if (!isInitializing && !token) {
      setTimeout(() => router.replace('/login'), 0);
    }
  }, [token, isInitializing, router]);

  // Hide the splash screen once auth state is known
  useEffect(() => {
    if (!isInitializing) {
      SplashScreen.hideAsync();
    }
  }, [isInitializing]);

  if (isInitializing) {
    return null;
  }

  return (
    <SocketProvider>
      <ConversationsProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </ConversationsProvider>
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