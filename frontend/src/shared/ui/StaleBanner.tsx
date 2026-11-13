import { WifiOff } from 'lucide-react';

interface StaleBannerProps {
  message: string;
}

// Shown over data that stopped refreshing, so the hall and phones do not freeze silently.
export function StaleBanner({ message }: StaleBannerProps) {
  return (
    <p role="alert" className="mb-4 inline-flex items-center gap-2 rounded-lg border border-danger px-3 py-2 text-danger">
      <WifiOff aria-hidden size={18} className="shrink-0" />
      Нет связи с сервером, данные не обновляются. {message}
    </p>
  );
}
