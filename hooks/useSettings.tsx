import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CODES } from '@/constants/codes';

const VISIBLE_CODES_KEY = 'chromacode_visible_codes';

interface SettingsContextType {
  visibleCodes: string[];
  toggleCodeVisibility: (codeName: string) => void;
  addCodeToVisibleCodes: (codeName: string) => void;
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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadVisibleCodes = async () => {
      try {
        const storedCodes = await AsyncStorage.getItem(VISIBLE_CODES_KEY);
        if (storedCodes) {
          setVisibleCodes(JSON.parse(storedCodes));
        } else {
          setVisibleCodes(CODES.map(c => c.name));
        }
      } catch (e) {
        console.error('Failed to load visible codes from AsyncStorage', e);
        setVisibleCodes(CODES.map(c => c.name));
      } finally {
        setIsLoaded(true);
      }
    };
    loadVisibleCodes();
  }, []);

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

  if (!isLoaded) {
    return null;
  }

  return (
    <SettingsContext.Provider value={{ visibleCodes, toggleCodeVisibility, addCodeToVisibleCodes }}>
      {children}
    </SettingsContext.Provider>
  );
}
