import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CODES, Code } from '@/constants/codes';

interface SettingsContextType {
  visibleCodes: string[];
  toggleCodeVisibility: (codeName: string) => void;
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
  const [visibleCodes, setVisibleCodes] = useState<string[]>(CODES.map(c => c.name));

  const toggleCodeVisibility = (codeName: string) => {
    setVisibleCodes(prevVisibleCodes => {
      if (prevVisibleCodes.includes(codeName)) {
        return prevVisibleCodes.filter(name => name !== codeName);
      } else {
        return [...prevVisibleCodes, codeName];
      }
    });
  };

  return (
    <SettingsContext.Provider value={{ visibleCodes, toggleCodeVisibility }}>
      {children}
    </SettingsContext.Provider>
  );
}
