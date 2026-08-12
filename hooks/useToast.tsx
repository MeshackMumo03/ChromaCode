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
      <InAppToast config={toastConfig} onHide={hideToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
