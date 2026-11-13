import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/shared/ui';

interface ShareButtonProps {
  url: string;
  title: string;
}

type ShareState = 'idle' | 'copied' | 'failed';

export function ShareButton({ url, title }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>('idle');

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The user closed the system share sheet; nothing to report.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="primary" size="lg" onClick={() => void share()}>
        <Share2 aria-hidden size={20} />
        Поделиться ссылкой
      </Button>
      {state === 'copied' && <p role="status">Ссылка скопирована</p>}
      {state === 'failed' && (
        <label className="flex w-full flex-col gap-1 text-sm text-muted">
          Скопируй ссылку вручную
          <input readOnly value={url} className="min-h-10 rounded-lg border border-line-strong bg-surface px-3 text-fg" />
        </label>
      )}
    </div>
  );
}
