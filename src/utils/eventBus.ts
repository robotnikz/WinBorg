
type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastEventDetail {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 4000) => {
    const event = new CustomEvent<ToastEventDetail>('show-toast', {
      detail: {
        id: Math.random().toString(36).substr(2, 9),
        message,
        type,
        duration
      }
    });
    window.dispatchEvent(event);
  },
  success: (msg: string) => toast.show(msg, 'success'),
  error: (msg: string) => toast.show(msg, 'error', 6000),
  info: (msg: string) => toast.show(msg, 'info'),
  loading: (msg: string) => toast.show(msg, 'loading', 0) // 0 = persistent
};
