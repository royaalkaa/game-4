import type { ReactNode } from 'react';
import { CircleAlert, Hourglass, Inbox, Lock } from 'lucide-react';

export type StateKind = 'loading' | 'empty' | 'error' | 'forbidden';

const icons = {
  loading: Hourglass,
  empty: Inbox,
  error: CircleAlert,
  forbidden: Lock,
} as const;

interface StateViewProps {
  kind: StateKind;
  title: string;
  message?: string;
  action?: ReactNode;
  large?: boolean;
}

export function StateView({ kind, title, message, action, large = false }: StateViewProps) {
  const Icon = icons[kind];
  return (
    <section
      role={kind === 'error' ? 'alert' : 'status'}
      data-state={kind}
      className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-12 text-center"
    >
      <Icon aria-hidden className={kind === 'error' ? 'text-danger' : 'text-muted'} size={large ? 96 : 40} />
      <h2 className={large ? 'text-6xl font-semibold' : 'text-xl font-semibold'}>{title}</h2>
      {message && <p className={large ? 'text-3xl text-muted' : 'text-muted'}>{message}</p>}
      {action}
    </section>
  );
}
