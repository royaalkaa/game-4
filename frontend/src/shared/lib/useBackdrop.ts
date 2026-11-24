import { useEffect } from 'react';

/** Ставит картинку фоном всей страницы, пока экран открыт; без картинки остаётся стандартная сетка. */
export function useBackdrop(url: string | null | undefined): void {
  useEffect(() => {
    if (!url) return;
    const { style } = document.body;
    const previous = {
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      backgroundAttachment: style.backgroundAttachment,
    };
    style.backgroundImage = `url("${url}")`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundAttachment = 'fixed';
    return () => {
      Object.assign(style, previous);
    };
  }, [url]);
}
