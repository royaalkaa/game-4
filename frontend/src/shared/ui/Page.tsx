import type { ReactNode } from 'react';

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">{children}</main>;
}
