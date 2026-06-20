
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastEventDetail {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 4000) => {
    const id = crypto.randomUUID();
    const event = new CustomEvent<ToastEventDetail>('show-toast', {
      detail: {
        id,
        message,
        type,
        duration
      }
    });
    window.dispatchEvent(event);
    return id;
  },
  dismiss: (id: string) => {
    window.dispatchEvent(new CustomEvent('dismiss-toast', { detail: id }));
  },
  success: (msg: string) => toast.show(msg, 'success'),
  error: (msg: string) => toast.show(msg, 'error', 6000),
  warning: (msg: string) => toast.show(msg, 'warning', 6000),
  info: (msg: string) => toast.show(msg, 'info'),
  loading: (msg: string) => toast.show(msg, 'loading', 0) // 0 = persistent
};
