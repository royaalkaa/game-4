import { useCallback } from 'react';
import { QR_REFRESH_MS } from '@/shared/config';
import { usePolling } from '@/shared/lib';
import { getJoinLink } from '@/entities/battle';

interface JoinLinkTextProps {
  battleId: string;
}

// The same link as in the QR, for guests whose camera does not read it.
export function JoinLinkText({ battleId }: JoinLinkTextProps) {
  const load = useCallback(() => getJoinLink(battleId), [battleId]);
  const { data } = usePolling(load, QR_REFRESH_MS);
  if (!data) return null;
  const shown = data.url.replace(/^https?:\/\//, '');
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all rounded-lg border border-line px-4 py-2 font-mono text-xl text-fg hover:border-primary"
    >
      {shown}
    </a>
  );
}
