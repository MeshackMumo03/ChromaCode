import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from './useSettings';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Always resolves to 'light' or 'dark' (never 'unspecified', null, or undefined).
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const systemColorScheme = useRNColorScheme();
  const { themePreference } = useSettings();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  const resolved = themePreference === 'system' ? systemColorScheme : themePreference;

  return resolved === 'dark' ? 'dark' : 'light';
}
