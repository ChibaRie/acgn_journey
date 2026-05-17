import { useMemo, useState } from 'react';
import { BadgeDollarSign, Edit3, Filter, MapPin, PackageCheck, PackageOpen } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import {
  INVENTORY_FORMATS,
  OPEN_STATUS_OPTIONS,
  getInventoryFormatLabel,
  getOpenStatusLabel,
  normalizeInventory,
} from '../utils/library.js';

function parsePrice(value) {
  const amount = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

export default function InventoryPanel({ records, onEditRecord, onUpdateRecord }) {
  const [filters, setFilters] = useState({
    keyword: '',
    format: '',
    openStatus: '',
    limitedOnly: false,
  });
  const [selectedRecordId, setSelectedRecordId] = useState('');

  const inventoryRecords = useMemo(
    () => records.filter((record) => normalizeInventory(record.inventory).owned),
    [records],
  );

  const filteredRecords = useMemo(
    () =>
      inventoryRecords.filter((record) => {
        const inventory = normalizeInventory(record.inventory);
        const keyword = filters.keyword.trim().toLowerCase();
        const keywordMatch =
          !keyword ||
          record.title.toLowerCase().includes(keyword) ||
          inventory.purchaseChannel.toLowerCase().includes(keyword) ||
          inventory.shelfLocation.toLowerCase().includes(keyword) ||
          inventory.notes.toLowerCase().includes(keyword);
        const formatMatch = !filters.format || inventory.format === filters.format;
        const openMatch = !filters.openStatus || inventory.openStatus === filters.openStatus;
        const limitedMatch = !filters.limitedOnly || inventory.limitedEdition;
        return keywordMatch && formatMatch && openMatch && limitedMatch;
      }),
    [filters, inventoryRecords],
  );

  const availableRecords = useMemo(
    () => records.filter((record) => !normalizeInventory(record.inventory).owned),
    [records],
  );

  const summary = useMemo(() => {
    const totalValue = inventoryRecords.reduce(
      (sum, record) => sum + parsePrice(record.inventory?.purchasePrice),
      0,
    );
    return {
      total: inventoryRecords.length,
      value: totalValue ? totalValue.toFixed(2).replace(/\.00$/, '') : '0',
      limited: inventoryRecords.filter((record) => normalizeInventory(record.inventory).limitedEdition)
        .length,
      sealed: inventoryRecords.filter((record) => normalizeInventory(record.inventory).openStatus === 'sealed')
        .length,
    };
  }, [inventoryRecords]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleQuickAdd = () => {
    const record = records.find((item) => item.id === selectedRecordId) || availableRecords[0];
    if (!record) return;
    onUpdateRecord(record.id, {
      inventory: normalizeInventory({
        ...record.inventory,
        owned: true,
      }),
    });
    setSelectedRecordId('');
  };

  return (
    <section className="panel" aria-labelledby="inventory-title">
      <div className="section-heading split">
        <div>
          <p className="eyebrow">实体库存</p>
          <h2 id="inventory-title">轻小说、BD、游戏光盘与实体藏品数据库</h2>
        </div>
        <div className="result-count">
          {filteredRecords.length} / {inventoryRecords.length}
        </div>
      </div>

      <div className="stat-cards inventory-summary">
        <article className="stat-card accent-red">
          <PackageCheck size={20} />
          <span>实体藏品</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="stat-card accent-teal">
          <BadgeDollarSign size={20} />
          <span>估算投入</span>
          <strong>{summary.value}</strong>
        </article>
        <article className="stat-card accent-amber">
          <PackageOpen size={20} />
          <span>未拆封</span>
          <strong>{summary.sealed}</strong>
        </article>
        <article className="stat-card accent-indigo">
          <MapPin size={20} />
          <span>限定版</span>
          <strong>{summary.limited}</strong>
        </article>
      </div>

      {records.length > 0 && (
        <div className="quick-add-row" aria-label="快速加入实体库存">
          <select
            value={selectedRecordId}
            onChange={(event) => setSelectedRecordId(event.target.value)}
            disabled={availableRecords.length === 0}
          >
            <option value="">
              {availableRecords.length > 0 ? '选择作品加入实体库存' : '所有作品都已在实体库存中'}
            </option>
            {availableRecords.map((record) => (
              <option key={record.id} value={record.id}>
                {record.title}
              </option>
            ))}
          </select>
          <button
            className="button secondary"
            type="button"
            onClick={handleQuickAdd}
            disabled={availableRecords.length === 0}
          >
            <PackageCheck size={16} />
            <span>设为实体藏品</span>
          </button>
        </div>
      )}

      <div className="filter-row" aria-label="实体库存筛选">
        <label className="filter-input grow">
          <Filter size={16} />
          <span className="sr-only">筛选实体库存</span>
          <input
            value={filters.keyword}
            onChange={(event) => updateFilter('keyword', event.target.value)}
            placeholder="按作品、渠道、位置、备注筛选"
          />
        </label>
        <select value={filters.format} onChange={(event) => updateFilter('format', event.target.value)}>
          <option value="">全部实体类型</option>
          {INVENTORY_FORMATS.map((format) => (
            <option key={format.value} value={format.value}>
              {format.label}
            </option>
          ))}
        </select>
        <select
          value={filters.openStatus}
          onChange={(event) => updateFilter('openStatus', event.target.value)}
        >
          <option value="">全部开封状态</option>
          {OPEN_STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <label className="check-row compact-check">
          <input
            type="checkbox"
            checked={filters.limitedOnly}
            onChange={(event) => updateFilter('limitedOnly', event.target.checked)}
          />
          <span>只看限定版</span>
        </label>
      </div>

      {records.length === 0 && (
        <EmptyState title="还没有作品记录" description="先把作品加入我的库，再在编辑弹窗里记录实体藏品信息。" />
      )}

      {records.length > 0 && inventoryRecords.length === 0 && (
        <EmptyState title="实体库存还是空的" description="在这里选择作品设为实体藏品，或进入编辑弹窗补充价格、渠道和摆放位置。" />
      )}

      {inventoryRecords.length > 0 && filteredRecords.length === 0 && (
        <EmptyState title="没有匹配的藏品" description="换一个实体类型、开封状态或关键词看看。" />
      )}

      <div className="inventory-grid">
        {filteredRecords.map((record) => {
          const inventory = normalizeInventory(record.inventory);
          return (
            <article className="inventory-card" key={record.id}>
              <div className="inventory-card-head">
                <div>
                  <p className="eyebrow">{getInventoryFormatLabel(inventory.format)}</p>
                  <h3>{record.title}</h3>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onEditRecord(record)}
                  aria-label={`编辑 ${record.title} 的实体库存`}
                  title="编辑"
                >
                  <Edit3 size={17} />
                </button>
              </div>
              <dl className="inventory-fields">
                <div>
                  <dt>购买价格</dt>
                  <dd>{inventory.purchasePrice || '未记录'}</dd>
                </div>
                <div>
                  <dt>购买渠道</dt>
                  <dd>{inventory.purchaseChannel || '未记录'}</dd>
                </div>
                <div>
                  <dt>摆放位置</dt>
                  <dd>{inventory.shelfLocation || '未记录'}</dd>
                </div>
                <div>
                  <dt>开封状态</dt>
                  <dd>{getOpenStatusLabel(inventory.openStatus)}</dd>
                </div>
              </dl>
              <div className="tag-row">
                {inventory.limitedEdition && <span>限定版</span>}
                {inventory.purchasedAt && <span>{inventory.purchasedAt}</span>}
                {inventory.notes && <span>{inventory.notes}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
