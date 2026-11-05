import { Download, X } from 'lucide-react';
import ModalDialog from './ModalDialog.jsx';

export default function RecoveryDialog({
  recovery,
  busy,
  onClose,
  onUseBaseline,
  onUseCandidate,
  onExport,
}) {
  return (
    <ModalDialog
      titleId="recovery-title"
      onClose={onClose}
      className="recovery-dialog"
    >
      <div className="dialog-heading">
        <h2 id="recovery-title">选择要恢复的作品库</h2>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="稍后处理副本"
        >
          <X size={20} />
        </button>
      </div>
      <p>
        发现可恢复的浏览器副本。请先导出需要保留的内容，再选择要使用的版本。
      </p>
      <div className="recovery-option">
        <div>
          <h3>{recovery.baselineLabel || '本机库'}</h3>
          <p>{recovery.baselineRecords.length} 部作品</p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onUseBaseline}
        >
          使用{recovery.baselineLabel || '本机库'}
        </button>
      </div>
      {recovery.candidates.map((candidate, index) => (
        <div className="recovery-option" key={candidate.id}>
          <div>
            <h3>浏览器副本 {index + 1}</h3>
            <p>
              {candidate.records.length} 部作品
              {candidate.updatedAt &&
                ` · ${new Date(candidate.updatedAt).toLocaleString()}`}
            </p>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="button secondary"
              onClick={() => onExport(candidate.records)}
            >
              <Download size={16} />
              导出 JSON
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => onUseCandidate(candidate)}
            >
              使用此副本
            </button>
          </div>
        </div>
      ))}
    </ModalDialog>
  );
}
