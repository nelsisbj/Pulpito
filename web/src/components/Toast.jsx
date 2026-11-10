import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, options = {}) => {
      const id = ++counter;
      const toast = { id, message, tone: options.tone || 'default' };
      setToasts((current) => [...current.slice(-2), toast]);
      setTimeout(() => remove(id), options.duration || 3200);
      return id;
    },
    [remove],
  );

  const value = useMemo(
    () => ({
      toast: push,
      error: (message) => push(message, { tone: 'error', duration: 4600 }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'is-error' : ''}`}>
              <Icon name={toast.tone === 'error' ? 'info' : 'check'} size={15} />
              <span>{toast.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider');
  return context;
}
