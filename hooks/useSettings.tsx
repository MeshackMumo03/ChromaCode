import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CODES } from '@/constants/codes';

const VISIBLE_CODES_KEY = 'chromacode_visible_codes';
const THEME_PREFERENCE_KEY = 'chromacode_theme_preference';
const NOTIFICATIONS_ENABLED_KEY = 'chromacode_notifications_enabled';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsContextType {
  visibleCodes: string[];
  toggleCodeVisibility: (codeName: string) => void;
  addCodeToVisibleCodes: (codeName: string) => void;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [visibleCodes, setVisibleCodes] = useState<string[]>([]);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [storedCodes, storedTheme, storedNotifs] = await Promise.all([
          AsyncStorage.getItem(VISIBLE_CODES_KEY),
          AsyncStorage.getItem(THEME_PREFERENCE_KEY),
          AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)
        ]);

        if (storedCodes) {
          setVisibleCodes(JSON.parse(storedCodes));
        } else {
          setVisibleCodes(CODES.map(c => c.name));
        }

        if (storedTheme) {
          setThemePreferenceState(storedTheme as ThemePreference);
        }

        if (storedNotifs !== null) {
          setNotificationsEnabledState(storedNotifs === 'true');
        }
      } catch (e) {
        console.error('Failed to load settings from AsyncStorage', e);
        setVisibleCodes(CODES.map(c => c.name));
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const setThemePreference = async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, pref);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());
    } catch (e) {
      console.error('Failed to save notification preference', e);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      const saveVisibleCodes = async () => {
        try {
          await AsyncStorage.setItem(VISIBLE_CODES_KEY, JSON.stringify(visibleCodes));
        } catch (e) {
          console.error('Failed to save visible codes to AsyncStorage', e);
        }
      };
      saveVisibleCodes();
    }
  }, [visibleCodes, isLoaded]);

  const toggleCodeVisibility = (codeName: string) => {
    setVisibleCodes(prevVisibleCodes => {
      if (prevVisibleCodes.includes(codeName)) {
        return prevVisibleCodes.filter(name => name !== codeName);
      } else {
        return [...prevVisibleCodes, codeName];
      }
    });
  };

  const addCodeToVisibleCodes = (codeName: string) => {
    setVisibleCodes(prevVisibleCodes => {
      if (!prevVisibleCodes.includes(codeName)) {
        return [...prevVisibleCodes, codeName];
      }
      return prevVisibleCodes;
    });
  };

  return (
    <SettingsContext.Provider value={{ 
      visibleCodes, 
      toggleCodeVisibility, 
      addCodeToVisibleCodes,
      themePreference,
      setThemePreference,
      notificationsEnabled,
      setNotificationsEnabled,
      isLoading: !isLoaded
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
