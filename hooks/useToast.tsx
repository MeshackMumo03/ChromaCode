import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { InAppToast, ToastConfig, ToastType } from '@/components/InAppToast';

const THEME_PREFERENCE_KEY = 'chromacode_theme_preference';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, subtitle?: string, accentColor?: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    visible: false,
    message: '',
    type: 'success',
  });

  // Resolve isDark for the toast card. ToastProvider sits above SettingsProvider
  // in the tree, so we cannot call useSettings() here. Instead we read the same
  // AsyncStorage key that SettingsProvider writes to whenever the user changes theme.
  const osScheme = useRNColorScheme();
  const [isDark, setIsDark] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const resolve = async () => {
      try {
        const pref = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (pref === 'dark') setIsDark(true);
        else if (pref === 'light') setIsDark(false);
        else setIsDark(osScheme === 'dark'); // 'system' or null → follow OS
      } catch {
        setIsDark(osScheme === 'dark');
      }
    };
    resolve();
  }, [osScheme]);

  // Re-sync whenever the user navigates back to the app (AppState active) or
  // whenever the OS scheme flips (covers 'system' preference).
  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((pref) => {
      if (pref === 'dark') setIsDark(true);
      else if (pref === 'light') setIsDark(false);
      else setIsDark(osScheme === 'dark');
    });
  }, [osScheme]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', subtitle?: string, accentColor?: string) => {
      // Resolve the theme right before showing the toast so it always reflects the latest setting.
      AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((pref) => {
        if (pref === 'dark') setIsDark(true);
        else if (pref === 'light') setIsDark(false);
        else setIsDark(osScheme === 'dark');
        
        setToastConfig({ visible: true, message, type, subtitle, accentColor });
      }).catch(() => {
        setIsDark(osScheme === 'dark');
        setToastConfig({ visible: true, message, type, subtitle, accentColor });
      });
    },
    [osScheme]
  );

  const hideToast = useCallback(() => {
    setToastConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {/* InAppToast is self-contained; isDark overrides OS detection with user pref */}
      <InAppToast config={toastConfig} onHide={hideToast} isDark={isDark} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  // Fail gracefully instead of throwing – a missing provider should not
  // crash the entire app, especially during hot-reloads or edge renders.
  if (context === undefined) {
    console.warn('[useToast] Called outside ToastProvider – toast will be a no-op.');
    return {
      showToast: (_message: string, _type?: ToastType, _subtitle?: string) => {},
      hideToast: () => {},
    };
  }

  return context;
};
