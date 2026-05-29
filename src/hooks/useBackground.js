import { useEffect, useState } from 'react';
import { DEFAULT_BACKGROUND, loadBackground, saveBackground } from '../utils/background.js';

export function useBackground() {
  const [background, setBackground] = useState(loadBackground);

  useEffect(() => {
    saveBackground(background);
  }, [background]);

  const setImage = (image) => setBackground((current) => ({ ...current, image }));
  const setOpacity = (opacity) => setBackground((current) => ({ ...current, opacity }));
  const setBlur = (blur) => setBackground((current) => ({ ...current, blur }));
  const clearImage = () => setBackground((current) => ({ ...current, image: DEFAULT_BACKGROUND.image }));

  return { background, setImage, setOpacity, setBlur, clearImage };
}
