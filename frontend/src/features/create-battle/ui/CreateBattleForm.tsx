import { useId, useState, type FormEvent } from 'react';
import { Heart, ImagePlus, Plus, Swords, X } from 'lucide-react';
import { asApiError, type BattleMode } from '@/shared/api';
import { Button } from '@/shared/ui';
import { setBackground } from '@/features/battle-background';
import { createBattle } from '../api/createBattle';

interface CreateBattleFormProps {
  onCreated: (battleId: number) => void;
}

const inputClass = 'min-h-11 rounded-md border-2 border-line-strong bg-surface px-3 focus-visible:outline-2 focus-visible:outline-primary';

export function CreateBattleForm({ onCreated }: CreateBattleFormProps) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [roundMinutes, setRoundMinutes] = useState(15);
  const [roundSeconds, setRoundSeconds] = useState(0);
  const [freezeMinutes, setFreezeMinutes] = useState(10);
  const [freezeSeconds, setFreezeSeconds] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [mode, setMode] = useState<BattleMode>('duel');
  const swipe = mode === 'swipe';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [background, setBackgroundFile] = useState<File | null>(null);
  const backgroundInputId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const battle = await createBattle({
        title: title.trim(),
        theme: theme.trim(),
        round_seconds: roundMinutes * 60 + roundSeconds,
        // Swipes have one vote and no score to hide, so freeze and auto-advance do not apply.
        freeze_seconds: swipe ? 0 : freezeMinutes * 60 + freezeSeconds,
        auto_advance: swipe ? false : autoAdvance,
        mode,
      });
      if (background) {
        // Батл уже создан: если фон не загрузился, его можно поставить на странице батла.
        await setBackground(battle.id, background).catch(() => undefined);
      }
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
      className="flex flex-col gap-4 rounded-md border-2 border-line-strong bg-surface p-4 shadow-hard sm:p-6 lg:sticky lg:top-6"
    >
      <h2 className="text-xl font-semibold">Новый батл</h2>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1">Режим</legend>
        {(
          [
            { value: 'duel', label: 'Дуэли', hint: '1 на 1, сетка', Icon: Swords },
            { value: 'swipe', label: 'Свайпы', hint: 'гости шлют фото, да/нет', Icon: Heart },
          ] as const
        ).map(({ value, label, hint, Icon }) => (
          <label
            key={value}
            className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 p-3 focus-within:outline-2 focus-within:outline-primary ${
              mode === value ? 'border-primary bg-primary-soft' : 'border-line-strong'
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="sr-only"
            />
            <span className="inline-flex items-center gap-2 font-semibold">
              <Icon aria-hidden size={18} />
              {label}
            </span>
            <span className="text-sm text-muted">{hint}</span>
          </label>
        ))}
      </fieldset>
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
      {durationFields(
        swipe ? 'Длительность голосования' : 'Длительность раунда',
        roundMinutes,
        setRoundMinutes,
        roundSeconds,
        setRoundSeconds,
      )}
      {!swipe &&
        durationFields('Заморозка счёта до конца раунда', freezeMinutes, setFreezeMinutes, freezeSeconds, setFreezeSeconds)}
      <label className={`flex items-center gap-3 ${swipe ? 'hidden' : ''}`}>
        <input
          type="checkbox"
          checked={autoAdvance}
          onChange={(event) => setAutoAdvance(event.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        Автостарт следующего раунда
      </label>
      <div className="flex flex-col gap-1">
        <span>Фон</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={backgroundInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="peer sr-only"
            onChange={(event) => {
              setBackgroundFile(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
            disabled={busy}
            aria-label="Фон батла"
          />
          <label
            htmlFor={backgroundInputId}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-2 border-line-strong bg-surface px-3 peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
          >
            <ImagePlus aria-hidden size={18} />
            {background ? 'Другой фон' : 'Загрузить (необязательно)'}
          </label>
          {background && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{background.name}</span>
              <button
                type="button"
                onClick={() => setBackgroundFile(null)}
                aria-label="Убрать выбранный фон"
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-primary-soft"
              >
                <X aria-hidden size={18} />
              </button>
            </>
          )}
        </div>
      </div>
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
