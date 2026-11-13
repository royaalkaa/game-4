import { StateView } from '@/shared/ui';

export function HomePage() {
  return (
    <StateView
      kind="empty"
      title="Фото-батлы"
      message="Чтобы голосовать, отсканируй QR-код на экране зала"
    />
  );
}
