import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from './useSettings';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const systemColorScheme = useRNColorScheme();
  const { themePreference } = useSettings();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (hasHydrated) {
    if (themePreference === 'system') {
        return systemColorScheme;
    }
    return themePreference;
  }

  return 'light';
}
