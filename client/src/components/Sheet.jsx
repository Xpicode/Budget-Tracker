import { useEffect, useRef } from 'react';

// A native <dialog> opened as a modal: backdrop, focus trap and Esc-to-close for free.
// onClose fires on Esc; parents also call it from their Cancel buttons.
export default function Sheet({ onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose}>
      {children}
    </dialog>
  );
}
