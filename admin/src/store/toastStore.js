import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = toast.id || crypto.randomUUID();
    const timeout = toast.timeout ?? 4200;

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    if (timeout > 0) {
      window.setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((item) => item.id !== id),
        }));
      }, timeout);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));

export default useToastStore;
