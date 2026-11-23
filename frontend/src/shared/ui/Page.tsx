import type { ReactNode } from 'react';

interface PageProps {
  children: ReactNode;
  // Host screens use the whole width of a laptop or monitor; guest screens stay readable on a phone column.
  wide?: boolean;
}

export function Page({ children, wide = false }: PageProps) {
  const width = wide ? 'max-w-[1600px] px-4 sm:px-6 lg:px-10' : 'max-w-5xl px-4';
  return <main className={`mx-auto flex w-full flex-col gap-6 py-6 ${width}`}>{children}</main>;
}
