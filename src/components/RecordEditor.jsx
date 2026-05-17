import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  INVENTORY_FORMATS,
  OPEN_STATUS_OPTIONS,
  STATUS_OPTIONS,
  getStatusLabel,
  normalizeInventory,
  normalizeTags,
} from '../utils/library.js';

export default function RecordEditor({ record, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    ...record,
    inventory: normalizeInventory(record.inventory),
    tagsText: (record.tags || []).join(' '),
  }));

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((status) => ({
        value: status.value,
        label: getStatusLabel(status.value, draft.type),
      })),
    [draft.type],
  );

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateInventory = (key, value) => {
    setDraft((current) => ({
      ...current,
      inventory: normalizeInventory({
        ...current.inventory,
        [key]: value,
      }),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const { tagsText, ...payload } = draft;
    onSave({
      ...payload,
      rating: Math.min(10, Math.max(0, Number(draft.rating) || 0)),
      releaseYear: String(draft.releaseYear || '').trim(),
      tags: normalizeTags(tagsText),
      inventory: normalizeInventory(draft.inventory),
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="editor-header">
          <div>
            <p className="eyebrow">编辑记录</p>
            <h2 id="editor-title">{record.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭编辑器">
            <X size={18} />
          </button>
        </div>

        <form className="editor-form" onSubmit={handleSubmit}>
          <label>
            <span>标题</span>
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
          </label>

          <div className="form-grid">
            <label>
              <span>类型</span>
              <input value={draft.type} onChange={(event) => updateDraft('type', event.target.value)} />
            </label>

            <label>
              <span>作品年份</span>
              <input
                inputMode="numeric"
                maxLength="4"
                value={draft.releaseYear || ''}
                onChange={(event) => updateDraft('releaseYear', event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="例如 2024"
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              <span>状态</span>
              <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>评分：{draft.rating || 0}/10</span>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={draft.rating || 0}
                onChange={(event) => updateDraft('rating', event.target.value)}
              />
            </label>
          </div>

          <div className="form-grid">
            <label>
              <span>开始日期</span>
              <input
                type="date"
                value={draft.startedAt || ''}
                onChange={(event) => updateDraft('startedAt', event.target.value)}
              />
            </label>

            <label>
              <span>完成日期</span>
              <input
                type="date"
                value={draft.finishedAt || ''}
                onChange={(event) => updateDraft('finishedAt', event.target.value)}
              />
            </label>
          </div>

          <label>
            <span>标签</span>
            <input
              value={draft.tagsText}
              onChange={(event) => updateDraft('tagsText', event.target.value)}
              placeholder="用空格或逗号分隔"
            />
          </label>

          <label>
            <span>短评</span>
            <textarea
              value={draft.comment}
              onChange={(event) => updateDraft('comment', event.target.value)}
              rows="4"
              placeholder="写下你的印象、补番契机或通关感受"
            />
          </label>

          <section className="editor-subsection" aria-label="实体库存">
            <div className="subsection-heading">
              <div>
                <p className="eyebrow">实体库存</p>
                <h3>藏品信息</h3>
              </div>
              <label className="check-row inline-check">
                <input
                  type="checkbox"
                  checked={draft.inventory.owned}
                  onChange={(event) => updateInventory('owned', event.target.checked)}
                />
                <span>我拥有实体藏品</span>
              </label>
            </div>

            <div className="form-grid">
              <label>
                <span>实体类型</span>
                <select
                  value={draft.inventory.format}
                  onChange={(event) => updateInventory('format', event.target.value)}
                >
                  {INVENTORY_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>购买价格</span>
                <input
                  inputMode="decimal"
                  value={draft.inventory.purchasePrice}
                  onChange={(event) => updateInventory('purchasePrice', event.target.value)}
                  placeholder="例如 298"
                />
              </label>
            </div>

            <div className="form-grid">
              <label>
                <span>购买渠道</span>
                <input
                  value={draft.inventory.purchaseChannel}
                  onChange={(event) => updateInventory('purchaseChannel', event.target.value)}
                  placeholder="例如 Animate / 淘宝 / 闲鱼"
                />
              </label>

              <label>
                <span>摆放位置</span>
                <input
                  value={draft.inventory.shelfLocation}
                  onChange={(event) => updateInventory('shelfLocation', event.target.value)}
                  placeholder="例如 书柜 A-2 / 展示柜"
                />
              </label>
            </div>

            <div className="form-grid">
              <label>
                <span>购买日期</span>
                <input
                  type="date"
                  value={draft.inventory.purchasedAt}
                  onChange={(event) => updateInventory('purchasedAt', event.target.value)}
                />
              </label>

              <label>
                <span>开封状态</span>
                <select
                  value={draft.inventory.openStatus}
                  onChange={(event) => updateInventory('openStatus', event.target.value)}
                >
                  {OPEN_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.inventory.limitedEdition}
                onChange={(event) => updateInventory('limitedEdition', event.target.checked)}
              />
              <span>限定版 / 特装版</span>
            </label>

            <label>
              <span>实体备注</span>
              <textarea
                value={draft.inventory.notes}
                onChange={(event) => updateInventory('notes', event.target.value)}
                rows="3"
                placeholder="记录特典、版本、瑕疵、签名或保养注意事项"
              />
            </label>
          </section>

          <div className="modal-actions">
            <button className="button secondary" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary" type="submit">
              <Save size={16} />
              <span>保存</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
