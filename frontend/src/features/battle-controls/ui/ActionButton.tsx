import { useCallback, useState, type ReactNode } from 'react';
import { asApiError } from '@/shared/api';
import { Button, ConfirmDialog } from '@/shared/ui';

interface ActionButtonProps {
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  // Irreversible actions pass a confirmation; its confirm button repeats the action label.
  confirm?: { title: string; message: string };
  action: () => Promise<unknown>;
  onDone: () => void;
}

export function ActionButton({
  label,
  icon,
  variant = 'secondary',
  className,
  confirm,
  action,
  onDone,
}: ActionButtonProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCallback(() => setAsking(false), []);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (caught) {
      setError(asApiError(caught).message);
    }
    setBusy(false);
    setAsking(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={variant}
        className={className}
        disabled={busy}
        onClick={() => (confirm ? setAsking(true) : void run())}
      >
        {icon}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirm && (
        <ConfirmDialog
          open={asking}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={label}
          danger={variant === 'danger'}
          busy={busy}
          onConfirm={() => void run()}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
