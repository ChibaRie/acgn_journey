import { X } from 'lucide-react';

export default function ConfirmModal({
  eyebrow = '确认操作',
  title,
  description,
  icon: Icon,
  tone = 'default',
  confirmLabel = '确认',
  cancelLabel = '取消',
  onCancel,
  onConfirm,
}) {
  const isDanger = tone === 'danger';

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        {Icon && (
          <div className={isDanger ? 'confirm-icon danger' : 'confirm-icon'} aria-hidden="true">
            <Icon size={22} />
          </div>
        )}
        <div className="confirm-content">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-description">{description}</p>
        </div>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={isDanger ? 'button danger' : 'button primary'}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
        <button
          className="icon-button confirm-close"
          type="button"
          onClick={onCancel}
          aria-label="关闭确认弹窗"
          title="关闭"
        >
          <X size={18} />
        </button>
      </section>
    </div>
  );
}
