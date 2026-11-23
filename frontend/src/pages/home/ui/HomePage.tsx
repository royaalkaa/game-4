import { LogIn } from 'lucide-react';
import { routePaths } from '@/shared/config';
import { ButtonLink, StateView } from '@/shared/ui';

export function HomePage() {
  return (
    <StateView
      kind="empty"
      title="Фото-батлы"
      message="Чтобы голосовать, отсканируй QR-код на экране зала"
      action={
        <ButtonLink to={routePaths.admin}>
          <LogIn aria-hidden size={18} />
          Вход для ведущего
        </ButtonLink>
      }
    />
  );
}
