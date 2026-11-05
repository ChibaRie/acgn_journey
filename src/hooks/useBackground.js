import { useEffect, useRef, useState } from 'react';
import { loadLocalSetting, saveLocalSetting } from '../utils/localApi.js';
import { DEFAULT_BACKGROUND, loadBackground, normalizeBackground, saveBackground } from '../utils/background.js';

export function useBackground() {
  const [background, setBackground] = useState(loadBackground);
  const [storage, setStorage] = useState({ mode: 'checking', status: 'checking', error: '', cacheError: '' });
  const [ready, setReady] = useState(false);
  const state = useRef({ background, ready: false, mode: 'checking', pending: null, saving: false, mounted: false });

  function updateStorage(patch) {
    if (state.current.mounted) setStorage((current) => ({ ...current, ...patch }));
  }

  function cache(value) {
    try {
      saveBackground(value);
      updateStorage({ cacheError: '' });
      return true;
    } catch (error) {
      updateStorage({ cacheError: error.message });
      return false;
    }
  }

  async function flush() {
    const current = state.current;
    if (current.saving) return;
    current.saving = true;
    try {
      while (current.pending && current.mounted) {
        const value = current.pending;
        current.pending = null;
        const cached = cache(value);
        if (current.mode === 'local') {
          updateStorage({ status: 'saving' });
          try {
            await saveLocalSetting('background', value);
            updateStorage({ status: 'saved', error: '' });
          } catch (error) {
            updateStorage({ status: cached ? 'pending' : 'error', error: error.message });
          }
        } else updateStorage({ status: cached ? 'saved' : 'error' });
      }
    } finally { current.saving = false; }
  }

  useEffect(() => {
    state.current.mounted = true;
    let active = true;
    (async () => {
      let setting;
      try {
        setting = await loadLocalSetting('background');
        if (!active) return;
        state.current.mode = 'local';
      } catch (error) {
        if (!active) return;
        state.current.mode = 'browser';
        updateStorage({ error: error.message });
      }
      if (setting?.value) {
        const value = normalizeBackground(setting.value);
        state.current.background = value;
        setBackground(value);
        cache(value);
      }
      state.current.ready = true;
      setReady(true);
      updateStorage({ mode: state.current.mode, status: 'saved' });
      if (!setting?.value && state.current.mode === 'local') {
        state.current.pending = state.current.background;
        flush();
      }
    })();
    return () => { active = false; state.current.mounted = false; };
  }, []);

  function change(patch) {
    const current = state.current;
    if (!current.ready) {
      const error = new Error('背景设置正在加载');
      error.code = 'BACKGROUND_NOT_READY';
      throw error;
    }
    const value = normalizeBackground({ ...current.background, ...patch });
    current.background = value;
    current.pending = value;
    setBackground(value);
    flush();
  }

  return {
    background, ready, storage,
    setImage: (image) => change({ image }),
    setOpacity: (opacity) => change({ opacity }),
    setBlur: (blur) => change({ blur }),
    clearImage: () => change({ image: DEFAULT_BACKGROUND.image }),
  };
}
