export const BACKGROUND_KEY = 'acgn_journey:background:v1';
const LEGACY_BACKGROUND_KEYS = [`${['my', 'acgn', 'journey'].join('-')}:background:v1`];

export const MAX_BACKGROUND_BYTES = 4 * 1024 * 1024;

export const DEFAULT_BACKGROUND = {
  image: '',
  opacity: 0.35,
  blur: 4,
};

function clamp(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function normalizeBackground(value) {
  const source = value && typeof value === 'object' ? value : {};
  const image = typeof source.image === 'string' ? source.image : '';
  return {
    image: image.startsWith('data:image/') ? image : '',
    opacity: clamp(source.opacity, 0, 1, DEFAULT_BACKGROUND.opacity),
    blur: clamp(source.blur, 0, 30, DEFAULT_BACKGROUND.blur),
  };
}

export function loadBackground() {
  try {
    const raw =
      localStorage.getItem(BACKGROUND_KEY) ||
      LEGACY_BACKGROUND_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return { ...DEFAULT_BACKGROUND };
    return normalizeBackground(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BACKGROUND };
  }
}

export function saveBackground(background) {
  const normalized = normalizeBackground(background);
  localStorage.setItem(BACKGROUND_KEY, JSON.stringify(normalized));
  return normalized;
}

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      reject(new Error('图片过大，请选择 4MB 以内的图片'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}
