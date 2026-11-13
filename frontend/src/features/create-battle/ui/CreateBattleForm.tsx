import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { asApiError } from '@/shared/api';
import { Button } from '@/shared/ui';
import { createBattle } from '../api/createBattle';

interface CreateBattleFormProps {
  onCreated: (battleId: number) => void;
}

const inputClass = 'min-h-11 rounded-lg border border-line-strong bg-surface px-3';

export function CreateBattleForm({ onCreated }: CreateBattleFormProps) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [roundMinutes, setRoundMinutes] = useState(15);
  const [roundSeconds, setRoundSeconds] = useState(0);
  const [freezeMinutes, setFreezeMinutes] = useState(10);
  const [freezeSeconds, setFreezeSeconds] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const battle = await createBattle({
        title: title.trim(),
        theme: theme.trim(),
        round_seconds: roundMinutes * 60 + roundSeconds,
        freeze_seconds: freezeMinutes * 60 + freezeSeconds,
        auto_advance: autoAdvance,
      });
      onCreated(battle.id);
    } catch (caught) {
      setError(asApiError(caught).message);
      setBusy(false);
    }
  };

  const durationFields = (
    legend: string,
    minutes: number,
    setMinutes: (value: number) => void,
    seconds: number,
    setSeconds: (value: number) => void,
  ) => (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1">{legend}</legend>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
          Минуты
          <input
            type="number"
            min={0}
            max={1440}
            required
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className={`${inputClass} text-base text-fg`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
          Секунды
          <input
            type="number"
            min={0}
            max={59}
            required
            value={seconds}
            onChange={(event) => setSeconds(Number(event.target.value))}
            className={`${inputClass} text-base text-fg`}
          />
        </label>
      </div>
    </fieldset>
  );

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-label="Новый батл"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="text-xl font-semibold">Новый батл</h2>
      <label className="flex flex-col gap-1">
        Название
        <input
          required
          maxLength={80}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        Тема
        <input maxLength={120} value={theme} onChange={(event) => setTheme(event.target.value)} className={inputClass} />
      </label>
      {durationFields('Длительность раунда', roundMinutes, setRoundMinutes, roundSeconds, setRoundSeconds)}
      {durationFields('Заморозка счёта до конца раунда', freezeMinutes, setFreezeMinutes, freezeSeconds, setFreezeSeconds)}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={autoAdvance}
          onChange={(event) => setAutoAdvance(event.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        Автостарт следующего раунда
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy || title.trim() === ''}>
        <Plus aria-hidden size={18} />
        Создать батл
      </Button>
    </form>
  );
}
