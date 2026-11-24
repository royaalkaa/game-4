import { useId, useState, type ChangeEvent } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { asApiError, type AdminBattle } from '@/shared/api';
import { Button } from '@/shared/ui';
import { clearBackground, setBackground } from '../api/backgroundApi';

interface BackgroundPickerProps {
  battle: AdminBattle;
  battleId: string;
  refresh: () => void;
}

/** Фон экрана зала и телефонов гостей: загрузить, заменить или убрать. */
export function BackgroundPicker({ battle, battleId, refresh }: BackgroundPickerProps) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = battle.background_url ?? null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (caught) {
      setError(asApiError(caught).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Сброс значения, чтобы повторный выбор того же файла снова вызвал событие.
    event.target.value = '';
    if (file) void run(() => setBackground(battleId, file));
  };

  return (
    <section aria-label="Фон" className="flex flex-col gap-3 rounded-md border-2 border-line bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold">Фон</h2>
        <p className="text-sm text-muted">На экране зала и телефонах гостей. JPEG, PNG или WebP до 10 МБ.</p>
      </div>
      {url && (
        <img src={url} alt="Текущий фон" className="aspect-video w-full max-w-sm rounded-md border-2 border-line object-cover" />
      )}
      <div className="flex flex-wrap gap-3">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="peer sr-only"
          onChange={upload}
          disabled={busy}
          aria-label="Выбрать фон"
        />
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-2 border-line-strong bg-surface px-4 font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-disabled:cursor-wait peer-disabled:opacity-60"
        >
          {busy ? <LoaderCircle aria-hidden size={18} className="animate-spin" /> : <ImagePlus aria-hidden size={18} />}
          {url ? 'Заменить фон' : 'Загрузить фон'}
        </label>
        {url && (
          <Button variant="danger" disabled={busy} onClick={() => void run(() => clearBackground(battleId))}>
            <Trash2 aria-hidden size={18} />
            Убрать фон
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
