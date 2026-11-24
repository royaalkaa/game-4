import type { ReactNode } from 'react';
import { Flame } from 'lucide-react';

interface RadarProps {
  photoUrl?: string | null;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}

// Waiting screen: rings spread from the guest's photo while the vote has not started or ended.
export function Radar({ photoUrl, title, message, action }: RadarProps) {
  return (
    <section role="status" className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        {[0, 1, 2].map((ring) => (
          <span
            key={ring}
            aria-hidden
            className="bg-brand absolute inset-0 animate-[ping-ring_2.4s_ease-out_infinite] rounded-full"
            style={{ animationDelay: `${ring * 0.8}s` }}
          />
        ))}
        <span className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-[#fff] bg-sunken shadow-[var(--shadow-soft)]">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="bg-brand flex h-full w-full items-center justify-center text-[#fff]">
              <Flame aria-hidden size={52} fill="currentColor" strokeWidth={1.5} />
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl">{title}</h2>
        {message && <p className="text-muted">{message}</p>}
      </div>
      {action}
    </section>
  );
}
