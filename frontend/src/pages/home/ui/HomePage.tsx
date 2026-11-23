import { LogIn, ScanLine } from 'lucide-react';
import { routePaths } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-10 px-5 py-10">
      <div className="relative mx-auto h-56 w-72 sm:h-64 sm:w-96" aria-hidden>
        <div className="absolute top-2 left-0 h-48 w-36 -rotate-6 rounded-md border-2 border-line-strong bg-primary shadow-hard sm:h-56 sm:w-44" />
        <div className="absolute top-4 right-0 h-48 w-36 rotate-6 rounded-md border-2 border-line-strong bg-accent shadow-hard sm:h-56 sm:w-44" />
        <span className="absolute top-1/2 left-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 -rotate-12 items-center justify-center rounded-full border-2 border-line-strong bg-surface font-display text-2xl font-bold shadow-hard">
          VS
        </span>
      </div>

      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-5xl font-bold leading-none sm:text-7xl">Фото-батлы</h1>
        <p className="mx-auto max-w-md text-lg text-muted">
          Две фотографии, один голос. Лучшая проходит дальше, пока в финале не останется одна.
        </p>
      </div>

      <p className="mx-auto inline-flex items-center gap-3 rounded-md border-2 border-dashed border-line-strong px-4 py-3 text-base">
        <ScanLine aria-hidden size={22} className="shrink-0 text-primary" />
        Чтобы голосовать, отсканируй QR-код на экране зала
      </p>

      <ButtonLink to={routePaths.admin} className="mx-auto">
        <LogIn aria-hidden size={18} />
        Вход для ведущего
      </ButtonLink>
    </main>
  );
}
