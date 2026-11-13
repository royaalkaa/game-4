import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { asApiError } from '@/shared/api';
import { Button, ProgressBar } from '@/shared/ui';
import { uploadPhoto } from '../api/photosApi';

interface UploadItem {
  key: number;
  file: File;
  caption: string;
  progress: number;
  uploading: boolean;
  error: string | null;
}

interface PhotoUploaderProps {
  battleId: string;
  onUploaded: () => void;
}

export function PhotoUploader({ battleId, onUploaded }: PhotoUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const nextKey = useRef(0);

  const update = (key: number, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        key: nextKey.current++,
        file,
        caption: '',
        progress: 0,
        uploading: false,
        error: null,
      })),
    ]);
  };

  const uploadAll = async () => {
    setBusy(true);
    for (const item of items) {
      update(item.key, { uploading: true, error: null, progress: 0 });
      try {
        await uploadPhoto(battleId, item.file, item.caption.trim(), (progress) => update(item.key, { progress }));
        setItems((prev) => prev.filter((other) => other.key !== item.key));
        onUploaded();
      } catch (caught) {
        update(item.key, { uploading: false, error: asApiError(caught).message });
      }
    }
    setBusy(false);
  };

  return (
    <section aria-label="Загрузка фото" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">Загрузка фото</h2>
      <p className="text-sm text-muted">JPEG, PNG или WebP до 10 МБ. Можно выбрать несколько файлов сразу.</p>
      <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-line-strong bg-surface px-4 py-2 font-medium transition-colors duration-150 hover:bg-surface-hover focus-within:outline-2 focus-within:outline-primary">
        <ImagePlus aria-hidden size={18} />
        Выбрать файлы
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={addFiles}
          disabled={busy}
          className="sr-only"
        />
      </label>
      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
                <Button
                  aria-label={`Убрать ${item.file.name}`}
                  className="min-h-9 px-2"
                  disabled={busy}
                  onClick={() => setItems((prev) => prev.filter((other) => other.key !== item.key))}
                >
                  <X aria-hidden size={16} />
                </Button>
              </div>
              <input
                aria-label={`Подпись к ${item.file.name}`}
                placeholder="Подпись (необязательно)"
                maxLength={80}
                value={item.caption}
                disabled={busy}
                onChange={(event) => update(item.key, { caption: event.target.value })}
                className="min-h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm"
              />
              {item.uploading && <ProgressBar value={item.progress} label={`Загрузка ${item.file.name}`} />}
              {item.error && (
                <p role="alert" className="text-sm text-danger">
                  {item.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <Button onClick={() => void uploadAll()} disabled={busy} className="w-fit">
          <Upload aria-hidden size={18} />
          Загрузить: {items.length}
        </Button>
      )}
    </section>
  );
}
