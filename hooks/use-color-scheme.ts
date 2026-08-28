import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettings } from './useSettings';

/**
 * Returns the color scheme based on user preference or system default.
 * Always resolves to 'light' or 'dark' (never 'unspecified', null, or undefined).
 */
export function useColorScheme(): 'light' | 'dark' {
  const systemColorScheme = useRNColorScheme();
  const { themePreference } = useSettings();

  const resolved = themePreference === 'system' ? systemColorScheme : themePreference;

  return resolved === 'dark' ? 'dark' : 'light';
}
