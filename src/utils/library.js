export const STORAGE_KEY = 'my-acgn-journey:records:v1';
export const BACKUP_VERSION = '0.2';

export const STATUS_OPTIONS = [
  { value: 'wish', defaultLabel: '想看', anime: '想看', book: '想读', game: '想玩' },
  { value: 'active', defaultLabel: '在看', anime: '在看', book: '在读', game: '在玩' },
  { value: 'done', defaultLabel: '已看', anime: '已看', book: '已读', game: '已玩' },
  { value: 'paused', defaultLabel: '搁置', anime: '搁置', book: '搁置', game: '搁置' },
  { value: 'dropped', defaultLabel: '抛弃', anime: '抛弃', book: '抛弃', game: '抛弃' },
];

export const WORK_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'galgame', label: 'Galgame' },
  { value: 'novel', label: '轻小说' },
  { value: 'anime', label: '动漫' },
  { value: 'comic', label: '漫画' },
  { value: 'other', label: '其他' },
];

export const INVENTORY_FORMATS = [
  { value: 'light-novel', label: '轻小说' },
  { value: 'bd', label: 'BD/DVD' },
  { value: 'game-disc', label: '游戏光盘' },
  { value: 'game-card', label: '游戏卡带' },
  { value: 'goods', label: '周边' },
  { value: 'other', label: '其他' },
];

export const OPEN_STATUS_OPTIONS = [
  { value: 'unknown', label: '未记录' },
  { value: 'sealed', label: '未拆封' },
  { value: 'opened', label: '已开封' },
];

export const RELATION_TYPES = [
  { value: 'series', label: '系列作品' },
  { value: 'same_world', label: '同一世界观' },
  { value: 'same_creator', label: '同一作者/会社' },
  { value: 'adaptation', label: '改编关系' },
  { value: 'spinoff', label: '衍生作品' },
  { value: 'other', label: '其他关联' },
];

export const DEFAULT_INVENTORY = {
  owned: false,
  format: 'light-novel',
  purchasePrice: '',
  purchaseChannel: '',
  shelfLocation: '',
  limitedEdition: false,
  openStatus: 'unknown',
  purchasedAt: '',
  notes: '',
};

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getSearchText(input) {
  if (typeof input === 'string') return input.toLowerCase();
  return [input?.type, input?.title, input?.originalTitle, ...(input?.tags || []), ...(input?.animeTags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getMedium(type = '') {
  const normalized = getSearchText(type);
  if (
    normalized.includes('书') ||
    normalized.includes('小说') ||
    normalized.includes('漫画') ||
    normalized.includes('book') ||
    normalized.includes('novel') ||
    normalized.includes('comic')
  ) {
    return 'book';
  }
  if (
    normalized.includes('game') ||
    normalized.includes('galgame') ||
    normalized.includes('游戏') ||
    normalized.includes('视觉小说')
  ) {
    return 'game';
  }
  if (
    normalized.includes('动画') ||
    normalized.includes('动漫') ||
    normalized.includes('番剧') ||
    normalized.includes('anime')
  ) {
    return 'anime';
  }
  return 'defaultLabel';
}

export function getWorkCategory(recordOrType) {
  const normalized = getSearchText(recordOrType);

  if (
    normalized.includes('galgame') ||
    normalized.includes('游戏') ||
    normalized.includes('game') ||
    normalized.includes('视觉小说')
  ) {
    return 'galgame';
  }

  if (
    normalized.includes('轻小说') ||
    normalized.includes('小说') ||
    normalized.includes('书籍') ||
    normalized.includes('novel') ||
    normalized.includes('book')
  ) {
    return 'novel';
  }

  if (
    normalized.includes('动漫') ||
    normalized.includes('动画') ||
    normalized.includes('番剧') ||
    normalized.includes('anime')
  ) {
    return 'anime';
  }

  if (normalized.includes('漫画') || normalized.includes('comic')) {
    return 'comic';
  }

  return 'other';
}

export function getCategoryLabel(category) {
  return WORK_CATEGORIES.find((item) => item.value === category)?.label || '其他';
}

export function getInventoryFormatLabel(format) {
  return INVENTORY_FORMATS.find((item) => item.value === format)?.label || '其他';
}

export function getOpenStatusLabel(status) {
  return OPEN_STATUS_OPTIONS.find((item) => item.value === status)?.label || '未记录';
}

export function getRelationTypeLabel(type) {
  return RELATION_TYPES.find((item) => item.value === type)?.label || '其他关联';
}

export function getYearFromDate(value) {
  if (!value) return '';
  const match = String(value).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

export function getWorkYear(record) {
  return (
    String(record?.releaseYear || '').trim() ||
    getYearFromDate(record?.releaseDate) ||
    getYearFromDate(record?.date) ||
    '未设置'
  );
}

export function getStatusLabel(status, type) {
  const option = STATUS_OPTIONS.find((item) => item.value === status) ?? STATUS_OPTIONS[0];
  const medium = getMedium(type);
  return option[medium] ?? option.defaultLabel;
}

export function getDoneLabel(type) {
  return getStatusLabel('done', type);
}

export function getWorkKey(work) {
  return `${work.source}:${work.sourceId || work.title}`.toLowerCase();
}

export function createRecordFromWork(work, overrides = {}) {
  const now = new Date().toISOString();
  const today = getToday();

  return {
    id: createId(),
    workKey: getWorkKey(work),
    source: work.source,
    sourceId: work.sourceId || '',
    sourceUrl: work.sourceUrl || '',
    title: work.title || '未命名作品',
    originalTitle: work.originalTitle || '',
    cover: work.cover || '',
    type: work.type || '未分类',
    summary: work.summary || '',
    releaseDate: work.releaseDate || '',
    releaseYear: work.releaseYear || getYearFromDate(work.releaseDate) || '',
    status: overrides.status || 'done',
    rating: Number(overrides.rating ?? 0),
    comment: overrides.comment || '',
    tags: Array.isArray(overrides.tags)
      ? normalizeTags(overrides.tags)
      : normalizeTags(work.tags || []),
    animeTags: normalizeTags(overrides.animeTags || work.animeTags || []),
    inventory: normalizeInventory(overrides.inventory),
    relations: normalizeRelations(overrides.relations),
    startedAt: overrides.startedAt || '',
    finishedAt: overrides.finishedAt || today,
    addedAt: now,
    updatedAt: now,
  };
}

export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function normalizeInventory(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const format = INVENTORY_FORMATS.some((item) => item.value === input.format)
    ? input.format
    : DEFAULT_INVENTORY.format;
  const openStatus = OPEN_STATUS_OPTIONS.some((item) => item.value === input.openStatus)
    ? input.openStatus
    : DEFAULT_INVENTORY.openStatus;

  return {
    ...DEFAULT_INVENTORY,
    ...input,
    owned: Boolean(input.owned),
    format,
    purchasePrice:
      input.purchasePrice === null || input.purchasePrice === undefined
        ? ''
        : String(input.purchasePrice),
    purchaseChannel: String(input.purchaseChannel || '').trim(),
    shelfLocation: String(input.shelfLocation || '').trim(),
    limitedEdition: Boolean(input.limitedEdition),
    openStatus,
    purchasedAt: String(input.purchasedAt || '').trim(),
    notes: String(input.notes || '').trim(),
  };
}

export function normalizeRelations(value = []) {
  if (!Array.isArray(value)) return [];

  return value
    .map((relation) => {
      const targetId = String(relation?.targetId || '').trim();
      if (!targetId) return null;
      const type = RELATION_TYPES.some((item) => item.value === relation?.type)
        ? relation.type
        : 'other';
      return {
        id: relation?.id || createId(),
        targetId,
        type,
        note: String(relation?.note || '').trim(),
      };
    })
    .filter(Boolean);
}

export function normalizeRecord(record) {
  const now = new Date().toISOString();
  const normalized = {
    ...record,
    id: record.id || createId(),
    workKey:
      record.workKey ||
      `${record.source || 'manual'}:${record.sourceId || record.title || createId()}`.toLowerCase(),
    source: record.source || 'manual',
    sourceId: record.sourceId || '',
    sourceUrl: record.sourceUrl || '',
    title: record.title || '未命名作品',
    originalTitle: record.originalTitle || '',
    cover: record.cover || '',
    type: record.type || '未分类',
    summary: record.summary || '',
    releaseDate: record.releaseDate || '',
    releaseYear: String(record.releaseYear || getYearFromDate(record.releaseDate) || '').trim(),
    status: record.status || 'done',
    rating: Number(record.rating || 0),
    comment: record.comment || '',
    tags: normalizeTags(record.tags || []),
    animeTags: normalizeTags(record.animeTags || []),
    inventory: normalizeInventory(record.inventory),
    relations: normalizeRelations(record.relations),
    startedAt: record.startedAt || '',
    finishedAt: record.finishedAt || '',
    addedAt: record.addedAt || now,
    updatedAt: record.updatedAt || now,
  };
  normalized.releaseYear = normalized.releaseYear || getYearFromDate(normalized.releaseDate);
  return normalized;
}

export function createBackup(records) {
  return {
    app: 'My ACGN Journey',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records: records.map(normalizeRecord),
  };
}

export function readBackup(payload) {
  const records = Array.isArray(payload) ? payload : payload?.records;
  if (!Array.isArray(records)) {
    throw new Error('备份文件格式不正确');
  }
  return records.map(normalizeRecord);
}

export function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,，;；#\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function getRecordYear(record) {
  const sourceDate = record.finishedAt || record.startedAt || record.addedAt;
  const year = sourceDate ? new Date(sourceDate).getFullYear() : NaN;
  return Number.isFinite(year) ? String(year) : '未设置';
}
