import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from './useSettings';

/**
 * Returns the color scheme based on user preference or system default.
 */
export function useColorScheme() {
  const systemColorScheme = useRNColorScheme();
  const { themePreference } = useSettings();

  if (themePreference === 'system') {
    return systemColorScheme;
  }

  return themePreference;
}
