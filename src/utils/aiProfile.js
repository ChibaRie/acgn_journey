const SAMPLE_LIMIT = 5;
const PRIVATE_FIELDS = new Set(['comment', 'summary', 'cover', 'sourceUrl']);

const DEFAULT_PROFILE = {
  summary: '',
  tasteProfile: '',
  favoriteThemes: [],
  mediaPreference: '',
  ratingStyle: '',
  completionHabits: '',
  personaTags: [],
  caveats: [],
  reflectionQuestions: [],
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toTimestamp(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function compareRecent(a, b) {
  return (
    toTimestamp(b.finishedAt || b.updatedAt || b.addedAt || b.startedAt) -
    toTimestamp(a.finishedAt || a.updatedAt || a.addedAt || a.startedAt)
  );
}

function sanitizeWork(record = {}) {
  return {
    title: record.title || '',
    originalTitle: record.originalTitle || '',
    type: record.type || '',
    source: record.source || '',
    status: record.status || '',
    rating: Number(record.rating || 0),
    releaseYear: String(record.releaseYear || '').trim(),
    tags: toArray(record.tags).map(String).filter(Boolean),
    animeTags: toArray(record.animeTags).map(String).filter(Boolean),
  };
}

function sanitizeStats(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeStats);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_FIELDS.has(key))
      .map(([key, item]) => [key, sanitizeStats(item)]),
  );
}

function takeSamples(records, predicate, sortFn) {
  return records
    .filter(predicate)
    .sort(sortFn)
    .slice(0, SAMPLE_LIMIT)
    .map(sanitizeWork);
}

export function buildAiProfileInput(records = [], stats = {}) {
  const library = toArray(records);

  return {
    schemaVersion: 1,
    recordCount: library.length,
    stats: sanitizeStats(stats || {}),
    representativeWorks: {
      highRated: takeSamples(
        library,
        (record) => Number(record.rating) > 0,
        (a, b) => Number(b.rating || 0) - Number(a.rating || 0) || compareRecent(a, b),
      ),
      recentDone: takeSamples(
        library,
        (record) => record.status === 'done',
        compareRecent,
      ),
      active: takeSamples(library, (record) => record.status === 'active', compareRecent),
      paused: takeSamples(library, (record) => record.status === 'paused', compareRecent),
      dropped: takeSamples(library, (record) => record.status === 'dropped', compareRecent),
    },
    privacy: {
      fullLibraryIncluded: false,
      representativeSampleLimit: SAMPLE_LIMIT,
      excludedFields: Array.from(PRIVATE_FIELDS),
    },
  };
}

export function buildAiProfilePrompt(profileInput) {
  return [
    {
      role: 'system',
      content:
        '你是一名 ACGN 作品库分析助手。请只根据用户提供的聚合摘要分析，不要编造未出现的作品细节。必须返回合法 JSON，不要输出 Markdown 或解释文字。',
    },
    {
      role: 'user',
      content: [
        '请根据下面的作品库聚合摘要生成 AI 用户画像 MVP。',
        '返回 JSON 对象，必须包含这些字段：summary, tasteProfile, favoriteThemes, mediaPreference, ratingStyle, completionHabits, personaTags, caveats, reflectionQuestions。',
        '字段建议：summary/tasteProfile/mediaPreference/ratingStyle/completionHabits 为中文字符串；favoriteThemes/personaTags/caveats/reflectionQuestions 为中文字符串数组。',
        '如果样本不足，请在 caveats 中说明不确定性；reflectionQuestions 给出 3-5 个可用于继续完善画像的问题。',
        '',
        '作品库聚合摘要：',
        JSON.stringify(profileInput, null, 2),
      ].join('\n'),
    },
  ];
}

function extractJsonText(text) {
  const rawText = String(text ?? '').trim();
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  const start = rawText.search(/[\[{]/);
  if (start < 0) return rawText;

  const open = rawText[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < rawText.length; index += 1) {
    const char = rawText[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return rawText.slice(start, index + 1);
    }
  }

  return rawText;
}

function normalizeProfile(parsed) {
  const input = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return {
    ...DEFAULT_PROFILE,
    ...input,
    favoriteThemes: toArray(input.favoriteThemes).map(String).filter(Boolean),
    personaTags: toArray(input.personaTags).map(String).filter(Boolean),
    caveats: toArray(input.caveats).map(String).filter(Boolean),
    reflectionQuestions: toArray(input.reflectionQuestions).map(String).filter(Boolean),
  };
}

export function parseAiProfileResponse(text) {
  const rawText = String(text ?? '');
  try {
    const parsed = JSON.parse(extractJsonText(rawText));
    return {
      parsed: normalizeProfile(parsed),
      rawText,
      error: null,
    };
  } catch (error) {
    return {
      parsed: null,
      rawText,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
