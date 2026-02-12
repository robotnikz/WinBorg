import { RefObject, useEffect, useRef } from 'react';

type Options = {
  initialFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
  );
}

export function useModalFocusTrap(isOpen: boolean, dialogRef: RefObject<HTMLElement | null>, options?: Options) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // Make sure the dialog itself can receive focus.
    if (!dialog.hasAttribute('tabindex')) {
      dialog.setAttribute('tabindex', '-1');
    }

    const initial = options?.initialFocusRef?.current;
    if (initial) {
      initial.focus();
    } else {
      const focusables = getFocusable(dialog);
      (focusables[0] ?? dialog).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const dialogEl = dialogRef.current;
      if (!dialogEl) return;

      const focusables = getFocusable(dialogEl);
      if (focusables.length === 0) {
        e.preventDefault();
        dialogEl.focus();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? focusables.indexOf(active) : -1;

      const goingBack = e.shiftKey;
      const nextIndex = goingBack
        ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
        : (currentIndex === -1 || currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1);

      // Only trap if focus is within the dialog; otherwise move focus to the first element.
      if (active && !dialogEl.contains(active)) {
        e.preventDefault();
        focusables[0].focus();
        return;
      }

      e.preventDefault();
      focusables[nextIndex].focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [isOpen, dialogRef, options?.initialFocusRef]);
}
