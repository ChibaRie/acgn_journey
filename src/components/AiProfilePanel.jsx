import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Clipboard,
  KeyRound,
  ListRestart,
  Loader2,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import {
  buildAiProfileInput,
  buildAiProfilePrompt,
  parseAiProfileResponse,
} from '../utils/aiProfile.js';
import {
  deleteLocalSetting,
  loadLocalSetting,
  requestAiModels,
  requestAiProfile,
  saveLocalSetting,
  testAiProfileConnection,
} from '../utils/localApi.js';

const LLM_PROFILE_SETTING_KEY = 'llm-profile';

const DEFAULT_CONFIG = {
  baseUrl: '',
  model: '',
  apiKey: '',
  temperature: '0.8',
};

const PROFILE_FIELDS = [
  ['summary', '画像摘要'],
  ['tasteProfile', '偏好轮廓'],
  ['favoriteThemes', '常见主题'],
  ['mediaPreference', '媒介偏好'],
  ['ratingStyle', '评分风格'],
  ['completionHabits', '完成习惯'],
  ['personaTags', '人格标签'],
  ['caveats', '注意事项'],
  ['reflectionQuestions', '继续追问'],
];

function toPromptText(messages) {
  return messages
    .map((message) => `${message.role.toUpperCase()}\n${message.content}`)
    .join('\n\n---\n\n');
}

function getResponseText(payload) {
  if (typeof payload === 'string') return payload;
  return payload?.rawText || payload?.text || payload?.content || '';
}

function isFilled(value) {
  return String(value ?? '').trim().length > 0;
}

function renderValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="muted-text">暂无</p>;
    return (
      <div className="ai-profile-chip-list">
        {value.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    );
  }

  if (!isFilled(value)) return <p className="muted-text">暂无</p>;
  return <p>{String(value)}</p>;
}

export default function AiProfilePanel({ records = [], stats = {}, storage = {}, onToast }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [modelOptions, setModelOptions] = useState([]);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const hasRecords = records.length > 0;
  const isLocalServiceReady = storage?.mode === 'local';
  const promptInput = useMemo(() => buildAiProfileInput(records, stats), [records, stats]);
  const promptMessages = useMemo(() => buildAiProfilePrompt(promptInput), [promptInput]);
  const promptText = useMemo(() => toPromptText(promptMessages), [promptMessages]);
  const hasProviderConfig =
    isLocalServiceReady && isFilled(config.baseUrl) && isFilled(config.apiKey);
  const canGenerate =
    hasRecords &&
    hasProviderConfig &&
    isFilled(config.model) &&
    !isGenerating &&
    !isTestingConnection;

  useEffect(() => {
    let cancelled = false;
    if (!isLocalServiceReady) {
      setStatusText('');
      return () => {
        cancelled = true;
      };
    }

    setConfigLoading(true);
    loadLocalSetting(LLM_PROFILE_SETTING_KEY)
      .then((setting) => {
        if (cancelled) return;
        const saved = setting?.value && typeof setting.value === 'object' ? setting.value : {};
        setConfig({
          ...DEFAULT_CONFIG,
          ...saved,
          apiKey: saved.apiKey || '',
          temperature: saved.temperature ?? DEFAULT_CONFIG.temperature,
        });
      })
      .catch(() => {
        if (!cancelled) setStatusText('尚未保存 LLM 配置。');
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLocalServiceReady]);

  const notify = (message) => {
    setStatusText(message);
    onToast?.(message);
  };

  const updateConfig = (key, value) => {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const getConfigPayload = ({ requireModel = true } = {}) => {
    const nextConfig = {
      baseUrl: config.baseUrl.trim(),
      model: config.model.trim(),
      apiKey: config.apiKey.trim(),
      temperature: config.temperature === '' ? 0.8 : Number(config.temperature),
    };

    if (!nextConfig.baseUrl || !nextConfig.apiKey || (requireModel && !nextConfig.model)) {
      notify(
        requireModel
          ? '请填写 Base URL、Model 和 API Key。'
          : '请先填写 Base URL 和 API Key。',
      );
      return null;
    }
    if (!Number.isFinite(nextConfig.temperature)) {
      notify('Temperature 必须是数字。');
      return null;
    }
    return nextConfig;
  };

  const saveConfig = async () => {
    if (!isLocalServiceReady) {
      notify('本机服务不可用，无法保存 LLM 配置。');
      return false;
    }

    const nextConfig = getConfigPayload();
    if (!nextConfig) return false;

    try {
      await saveLocalSetting(LLM_PROFILE_SETTING_KEY, nextConfig);
      notify('LLM 配置已保存到本机服务。');
      return true;
    } catch (error) {
      notify(error.message || 'LLM 配置保存失败。');
      return false;
    }
  };

  const clearConfig = async () => {
    if (!isLocalServiceReady) {
      notify('本机服务不可用，无法清除 LLM 配置。');
      return;
    }

    try {
      await deleteLocalSetting(LLM_PROFILE_SETTING_KEY);
      setConfig(DEFAULT_CONFIG);
      setModelOptions([]);
      setResult(null);
      notify('LLM 配置已清除。');
    } catch (error) {
      notify(error.message || 'LLM 配置清除失败。');
    }
  };

  const loadModels = async () => {
    if (!isLocalServiceReady) {
      notify('本机服务不可用，无法获取模型列表。');
      return;
    }

    const nextConfig = getConfigPayload({ requireModel: false });
    if (!nextConfig) return;

    setIsLoadingModels(true);
    try {
      const payload = await requestAiModels(nextConfig);
      const models = Array.isArray(payload?.models) ? payload.models : [];
      setModelOptions(models);
      if (!config.model.trim() && models[0]?.id) {
        updateConfig('model', models[0].id);
      }
      notify(models.length ? `已获取 ${models.length} 个模型。` : '模型接口可用，但没有返回模型。');
    } catch (error) {
      notify(error.message || '模型列表获取失败。');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const testConnection = async () => {
    if (!isLocalServiceReady) {
      notify('本机服务不可用，无法测试连通性。');
      return;
    }

    const nextConfig = getConfigPayload();
    if (!nextConfig) return;

    setIsTestingConnection(true);
    try {
      const payload = await testAiProfileConnection(nextConfig);
      notify(`连通性正常：${payload.model || nextConfig.model}`);
    } catch (error) {
      notify(error.message || 'LLM 连通性测试失败。');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const copyPrompt = async () => {
    if (!hasRecords) {
      notify('空库暂无可复制的画像 Prompt。');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      notify('Prompt 已复制。');
    } catch {
      notify('复制失败，请手动选中预览内容复制。');
    }
  };

  const generateProfile = async () => {
    if (!hasRecords) {
      notify('请先添加作品记录，再生成 AI 用户画像。');
      return;
    }
    if (!isLocalServiceReady) {
      notify('当前环境不支持真实 AI 调用，请复制 Prompt 到桌面版或外部 LLM。');
      return;
    }
    if (!canGenerate) {
      notify('请先补全 LLM 配置。');
      return;
    }

    setIsGenerating(true);
    setStatusText('');
    try {
      const saved = await saveConfig();
      if (!saved) return;
      const payload = await requestAiProfile(promptMessages);
      const rawText = getResponseText(payload);
      const parsed = parseAiProfileResponse(rawText);
      setResult({
        ...payload,
        rawText,
        parsed: parsed.parsed,
        parseError: parsed.error,
      });
      notify(parsed.error ? '画像已返回，但未能解析为结构化 JSON。' : 'AI 用户画像已生成。');
    } catch (error) {
      notify(error.message || 'AI 用户画像生成失败。');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!hasRecords) {
    return (
      <section className="panel ai-profile-panel" aria-labelledby="ai-profile-title">
        <div className="section-heading split">
          <div>
            <p className="eyebrow">AI 用户画像</p>
            <h2 id="ai-profile-title">从作品库生成偏好洞察</h2>
          </div>
        </div>
        <EmptyState
          title="先建立你的作品库"
          description="添加一些已看、在看或弃坑作品后，才会开放画像分析。空库不会发起 AI 请求。"
        />
      </section>
    );
  }

  return (
    <section className="panel ai-profile-panel" aria-labelledby="ai-profile-title">
      <div className="section-heading split">
        <div>
          <p className="eyebrow">AI 用户画像</p>
          <h2 id="ai-profile-title">用本地汇总数据生成 ACGN 偏好画像</h2>
        </div>
        <div className="result-count">{records.length} 条记录</div>
      </div>

      <div className="ai-profile-grid">
        <section className="stat-section ai-profile-privacy" aria-label="隐私说明">
          <ShieldCheck size={22} />
          <div>
            <h3>隐私说明</h3>
            <p>
              组件只预览并发送作品库的汇总统计和代表样本，不包含评论、封面、来源链接等私密字段。
              API Key 保存到桌面本机服务，不会展示在 Prompt 预览中。
            </p>
          </div>
        </section>

        <section className="stat-section ai-profile-service" aria-label="服务状态">
          <BrainCircuit size={22} />
          <div>
            <h3>{isLocalServiceReady ? '桌面本机服务可用' : '当前环境不可真实调用'}</h3>
            <p>
              {isLocalServiceReady
                ? `配置将保存到 ${storage.type || 'local'}${storage.path ? `：${storage.path}` : ''}。`
                : 'Pages 或本机服务不可用时不会请求 AI。请复制 Prompt，在桌面版或外部 LLM 中使用。'}
            </p>
          </div>
        </section>
      </div>

      <section
        className={`ai-profile-preview ${promptExpanded ? 'expanded' : 'collapsed'}`}
        aria-label="将发送给 AI 的内容"
      >
        <div className="section-heading split compact-heading">
          <div>
            <p className="eyebrow">Prompt Preview</p>
            <h3>将发送给 AI 的内容</h3>
          </div>
          <div className="ai-profile-preview-actions">
            <button
              className="button secondary"
              type="button"
              aria-expanded={promptExpanded}
              onClick={() => setPromptExpanded((current) => !current)}
            >
              {promptExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{promptExpanded ? '收起预览' : '展开预览'}</span>
            </button>
            <button className="button secondary" type="button" onClick={copyPrompt}>
              <Clipboard size={16} />
              <span>复制 Prompt</span>
            </button>
          </div>
        </div>
        {promptExpanded ? (
          <pre>{promptText}</pre>
        ) : (
          <p className="muted-text">Prompt 默认折叠；点击展开可审阅完整发送内容。</p>
        )}
      </section>

      {isLocalServiceReady ? (
        <section className="ai-profile-config" aria-label="LLM 配置">
          <div className="section-heading split compact-heading">
            <div>
              <p className="eyebrow">LLM Config</p>
              <h3>桌面版模型配置</h3>
            </div>
            {configLoading && <span className="muted-text">读取配置中...</span>}
          </div>

          <div className="ai-profile-form">
            <label>
              <span>Base URL</span>
              <input
                type="url"
                value={config.baseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(event) => updateConfig('baseUrl', event.target.value)}
              />
            </label>
            <label className="ai-profile-model-field">
              <span>Model</span>
              <div className="ai-profile-field-row">
                <input
                  list="ai-profile-model-options"
                  value={config.model}
                  placeholder="gpt-4.1-mini"
                  onChange={(event) => updateConfig('model', event.target.value)}
                />
                <button
                  className="button secondary compact-button"
                  type="button"
                  disabled={!hasProviderConfig || isLoadingModels}
                  onClick={loadModels}
                >
                  {isLoadingModels ? (
                    <Loader2 className="spin-icon" size={16} />
                  ) : (
                    <ListRestart size={16} />
                  )}
                  <span>{isLoadingModels ? '获取中' : '获取模型'}</span>
                </button>
              </div>
              <datalist id="ai-profile-model-options">
                {modelOptions.map((model) => (
                  <option
                    key={model.id}
                    value={model.id}
                    label={model.ownedBy ? `${model.id} · ${model.ownedBy}` : model.id}
                  />
                ))}
              </datalist>
            </label>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={config.apiKey}
                placeholder="sk-..."
                onChange={(event) => updateConfig('apiKey', event.target.value)}
              />
            </label>
            <label>
              <span>Temperature</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(event) => updateConfig('temperature', event.target.value)}
              />
            </label>
          </div>

          <div className="ai-profile-actions">
            <button className="button secondary" type="button" onClick={saveConfig}>
              <KeyRound size={16} />
              <span>保存配置</span>
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={!canGenerate || isTestingConnection}
              onClick={testConnection}
            >
              {isTestingConnection ? (
                <Loader2 className="spin-icon" size={16} />
              ) : (
                <PlugZap size={16} />
              )}
              <span>{isTestingConnection ? '测试中' : '测试连通'}</span>
            </button>
            <button className="button secondary" type="button" onClick={clearConfig}>
              <Trash2 size={16} />
              <span>清除配置</span>
            </button>
            <button
              className="button primary"
              type="button"
              disabled={!canGenerate || isGenerating}
              onClick={generateProfile}
            >
              {isGenerating ? <Loader2 className="spin-icon" size={16} /> : <Sparkles size={16} />}
              <span>{isGenerating ? '生成中...' : '生成画像'}</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="warning-strip">
          <ShieldCheck size={17} />
          <span>真实 AI 调用仅在桌面版本机服务可用时开启。当前可先复制 Prompt 手动分析。</span>
        </div>
      )}

      {statusText && <p className="ai-profile-status">{statusText}</p>}

      {result && (
        <section className="ai-profile-result" aria-label="AI 用户画像结果">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Profile Result</p>
              <h3>画像结果</h3>
            </div>
          </div>

          {result.parsed ? (
            <div className="ai-profile-result-grid">
              {PROFILE_FIELDS.map(([key, label]) => (
                <article className="stat-section ai-profile-result-card" key={key}>
                  <h4>{label}</h4>
                  {renderValue(result.parsed[key])}
                </article>
              ))}
            </div>
          ) : (
            <article className="stat-section ai-profile-raw">
              <h4>原始输出</h4>
              <pre>{result.rawText || '暂无内容'}</pre>
            </article>
          )}
        </section>
      )}
    </section>
  );
}
