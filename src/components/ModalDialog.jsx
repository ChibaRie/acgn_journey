import { useEffect, useRef } from 'react';

export default function ModalDialog({ titleId, onClose, className = '', children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => {
      dialog.close();
      const canRestore = trigger?.isConnected && !trigger.disabled
        && !trigger.matches('body, html') && !trigger.closest('dialog:not([open])');
      const target = canRestore ? trigger : document.querySelector('[data-focus-fallback]');
      target?.focus({ preventScroll: true });
    };
  }, []);

  const handleBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) onCloseRef.current();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`modal-dialog ${className}`.trim()}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onCloseRef.current(); }}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}
