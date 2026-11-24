import { useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { asApiError, type Photo } from '@/shared/api';
import { Button, ConfirmDialog, PhotoFrame, StateView } from '@/shared/ui';
import { deletePhoto } from '../api/photosApi';

interface DraftPhotoGridProps {
  battleId: string;
  photos: Photo[];
  onChanged: () => void;
  emptyMessage?: string;
}

export function DraftPhotoGrid({
  battleId,
  photos,
  onChanged,
  emptyMessage = 'Загрузи от 2 до 16 фото, чтобы запустить батл',
}: DraftPhotoGridProps) {
  const [target, setTarget] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCallback(() => setTarget(null), []);

  const confirmDelete = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await deletePhoto(battleId, target.id);
      onChanged();
    } catch (caught) {
      setError(asApiError(caught).message);
    }
    setBusy(false);
    setTarget(null);
  };

  if (photos.length === 0) {
    return <StateView kind="empty" title="Фото пока нет" message={emptyMessage} />;
  }

  return (
    <section aria-label="Фото батла" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Фото: {photos.length}</h2>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2">
            <PhotoFrame src={photo.url} alt={photo.caption ?? `Фото ${index + 1}`} className="h-36 w-full" />
            <p className="truncate text-sm">{photo.caption || 'Без подписи'}</p>
            <Button variant="danger" className="min-h-9 text-sm" onClick={() => setTarget(photo)}>
              <Trash2 aria-hidden size={16} />
              Удалить
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title="Удалить фото?"
        message="Фото будет удалено из батла без возможности восстановления."
        confirmLabel="Удалить фото"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={cancel}
      />
    </section>
  );
}
