import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { asApiError, type Photo } from '@/shared/api';
import { Button, ProgressBar } from '@/shared/ui';
import { uploadMyPhoto } from '../api/myPhotoApi';

interface MyPhotoFormProps {
  battleId: string;
  current: Photo | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const inputClass =
  'min-h-12 rounded-md border-2 border-line-strong bg-surface px-3 text-lg focus-visible:outline-2 focus-visible:outline-primary';

export function MyPhotoForm({ battleId, current, onSaved, onCancel }: MyPhotoFormProps) {
  const [name, setName] = useState(current?.caption ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setProgress(0);
    setError(null);
    try {
      await uploadMyPhoto(battleId, file, name.trim(), setProgress);
      onSaved();
    } catch (caught) {
      setError(asApiError(caught).message);
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const shown = preview ?? current?.url ?? null;

  return (
    <form onSubmit={(event) => void submit(event)} aria-label="Твоё фото" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-2xl">Загрузи фото и имя</h2>
        <p className="text-muted">Потом все свайпают: вправо да, влево нет. За себя голосовать нельзя.</p>
      </div>
      <label className="relative flex h-[46svh] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed border-line-strong bg-sunken focus-within:outline-2 focus-within:outline-primary">
        {shown ? (
          <img src={shown} alt="Твоё фото" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="font-semibold text-muted">Сделать или выбрать фото</span>
        )}
        {/* The round add button in the corner, as in a profile photo grid. */}
        <span
          aria-hidden
          className="bg-brand absolute right-3 bottom-3 flex h-12 w-12 items-center justify-center rounded-full text-[#fff] shadow-[var(--shadow-soft)]"
        >
          <Plus size={28} strokeWidth={3} />
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pick}
          disabled={busy}
          aria-label="Выбрать фото"
          className="sr-only"
        />
      </label>
      <label className="flex flex-col gap-1 font-medium">
        Имя или ФИО
        <input
          required
          maxLength={80}
          autoComplete="name"
          placeholder="Например, Анна Иванова"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </label>
      {busy && <ProgressBar value={progress} label="Загрузка фото" />}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={busy || !file || name.trim() === ''}>
        {current ? 'Сохранить' : 'Участвовать'}
      </Button>
      {onCancel && (
        <Button onClick={onCancel} disabled={busy}>
          Отмена
        </Button>
      )}
    </form>
  );
}
