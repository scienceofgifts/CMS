import { useEffect, useRef } from 'react';

type ModalEntry = {
  id: symbol;
  onCloseRef: React.MutableRefObject<(() => void) | undefined>;
};

const modalStack: ModalEntry[] = [];
let isListenerAttached = false;

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.code === 'Escape') {
    if (modalStack.length > 0) {
      const topModal = modalStack[modalStack.length - 1];
      if (topModal && topModal.onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        topModal.onCloseRef.current();
      }
    }
  }
}

function attachListener() {
  if (!isListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown, true);
    isListenerAttached = true;
  }
}

/**
 * Hook to allow pressing the Escape key to close open modal/overlay windows.
 * Stack-aware: Supports nested/child overlays where Escape closes only the topmost active overlay.
 */
export function useModalEscape(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !onClose) return;

    attachListener();
    const id = Symbol('modal');
    const entry: ModalEntry = { id, onCloseRef };
    modalStack.push(entry);

    return () => {
      const index = modalStack.findIndex((item) => item.id === id);
      if (index !== -1) {
        modalStack.splice(index, 1);
      }
    };
  }, [isOpen, Boolean(onClose)]);
}
