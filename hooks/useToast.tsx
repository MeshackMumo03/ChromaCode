import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { InAppToast, ToastConfig, ToastType } from '@/components/InAppToast';

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

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', subtitle?: string, accentColor?: string) => {
      setToastConfig({ visible: true, message, type, subtitle, accentColor });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToastConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {/* InAppToast is self-contained and has NO context dependencies */}
      <InAppToast config={toastConfig} onHide={hideToast} />
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
