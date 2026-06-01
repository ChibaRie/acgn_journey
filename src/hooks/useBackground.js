import { useEffect, useState } from 'react';
import { loadLocalSetting, saveLocalSetting } from '../utils/localApi.js';
import { DEFAULT_BACKGROUND, loadBackground, saveBackground } from '../utils/background.js';

export function useBackground() {
  const [storageMode, setStorageMode] = useState('checking');
  const [background, setBackground] = useState(loadBackground);

  useEffect(() => {
    let cancelled = false;
    loadLocalSetting('background')
      .then((setting) => {
        if (cancelled) return;
        if (setting?.value) {
          setBackground(saveBackground(setting.value));
        } else {
          saveLocalSetting('background', background).catch(() => {});
        }
        setStorageMode('local');
      })
      .catch(() => {
        if (!cancelled) setStorageMode('browser');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (storageMode === 'checking') return;
    saveBackground(background);
    if (storageMode === 'local') {
      saveLocalSetting('background', background).catch(() => setStorageMode('browser'));
    }
  }, [background, storageMode]);

  const setImage = (image) => setBackground((current) => ({ ...current, image }));
  const setOpacity = (opacity) => setBackground((current) => ({ ...current, opacity }));
  const setBlur = (blur) => setBackground((current) => ({ ...current, blur }));
  const clearImage = () => setBackground((current) => ({ ...current, image: DEFAULT_BACKGROUND.image }));

  return { background, setImage, setOpacity, setBlur, clearImage };
}
