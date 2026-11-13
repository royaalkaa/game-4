import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { asApiError } from '@/shared/api';
import { Button } from '@/shared/ui';
import { adminLogin } from '../api/authApi';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      onSuccess();
    } catch (caught) {
      setError(asApiError(caught).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto flex w-full max-w-sm flex-col gap-4 py-12">
      <h1 className="text-2xl font-bold">Вход для ведущего</h1>
      <label className="flex flex-col gap-1">
        <span>Пароль</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 rounded-lg border border-line-strong bg-surface px-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy || password === ''}>
        <LogIn aria-hidden size={18} />
        Войти
      </Button>
    </form>
  );
}
