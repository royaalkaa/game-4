import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Heart, X } from 'lucide-react';
import { asApiError, type Photo } from '@/shared/api';
import { SWIPE_FLY_MS } from '@/shared/config';
import { sendSwipe } from '../api/swipeApi';
import { stampOpacity, swipeDecision } from '../model/gesture';

// These answers mean the card no longer needs a vote; the deck simply moves on.
const SKIP_CODES = new Set(['already_swiped', 'own_photo']);

interface SwipeDeckProps {
  photos: Photo[];
  total: number;
  onDone: () => void;
  onClosed: () => void;
}

interface Drag {
  startX: number;
  startY: number;
  startedAt: number;
  dx: number;
  dy: number;
}

export function SwipeDeck({ photos, total, onDone, onClosed }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [flying, setFlying] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const card = photos.at(index);
  const next = photos.at(index + 1);
  const done = total - (photos.length - index);

  useEffect(() => {
    if (photos.length > 0 && index >= photos.length) onDone();
  }, [index, photos.length, onDone]);

  const answer = useCallback(
    async (liked: boolean) => {
      if (!card || busy.current) return;
      busy.current = true;
      setError(null);
      setFlying(liked);
      const flight = new Promise((resolve) => setTimeout(resolve, SWIPE_FLY_MS));
      try {
        await Promise.all([sendSwipe(card.id, liked), flight]);
        setIndex((value) => value + 1);
      } catch (caught) {
        const apiError = asApiError(caught);
        await flight;
        if (SKIP_CODES.has(apiError.code)) {
          setIndex((value) => value + 1);
        } else if (apiError.code === 'voting_closed') {
          onClosed();
        } else {
          setError(`Голос не отправлен. ${apiError.message}`);
        }
      }
      setFlying(null);
      setDrag(null);
      busy.current = false;
    },
    [card, onClosed],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') void answer(true);
      if (event.key === 'ArrowLeft') void answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  if (!card) return null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (busy.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY, startedAt: event.timeStamp, dx: 0, dy: 0 });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || busy.current) return;
    setDrag({ ...drag, dx: event.clientX - drag.startX, dy: event.clientY - drag.startY });
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || busy.current) return;
    const decision = swipeDecision(drag.dx, event.timeStamp - drag.startedAt);
    if (decision === null) setDrag(null);
    else void answer(decision);
  };

  const dx = flying === null ? (drag?.dx ?? 0) : flying ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
  const dy = flying === null ? (drag?.dy ?? 0) * 0.3 : (drag?.dy ?? 0) * 0.3;
  const moving = drag !== null && flying === null;
  const yesOpacity = flying === true ? 1 : dx > 0 ? stampOpacity(dx) : 0;
  const noOpacity = flying === false ? 1 : dx < 0 ? stampOpacity(dx) : 0;
  const name = card.caption ?? 'Без имени';

  const progress = total > 0 ? done / total : 0;
  const white = 'text-[#fff]';

  return (
    <section aria-label="Голосование свайпом" className="flex flex-col gap-4 select-none">
      <div className="relative h-[66svh] w-full touch-none">
        {next && (
          <div aria-hidden className="absolute inset-0 scale-[0.96] overflow-hidden rounded-lg bg-sunken">
            <img src={next.url} alt="" className="h-full w-full object-cover" draggable={false} />
          </div>
        )}
        <div
          key={card.id}
          data-testid="swipe-card"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          className={`absolute inset-0 cursor-grab overflow-hidden rounded-lg bg-sunken shadow-[var(--shadow-soft)] active:cursor-grabbing ${
            index === 0 && drag === null && flying === null ? 'animate-[nudge_1.6s_ease-in-out_0.6s_2]' : ''
          }`}
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`,
            transition: moving ? 'none' : `transform ${SWIPE_FLY_MS}ms ease-out`,
          }}
        >
          <img src={card.url} alt={name} className="h-full w-full object-cover" draggable={false} />
          {/* Thin bar over the photo shows how far through the deck the guest is. */}
          <div aria-hidden className="absolute inset-x-3 top-2.5 h-1 overflow-hidden rounded-full bg-[rgb(255_255_255/0.35)]">
            <div className="h-full rounded-full bg-[#fff] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <span
            aria-hidden
            className="absolute top-12 left-6 -rotate-20 rounded-lg border-[5px] border-success px-3 py-0.5 text-5xl font-extrabold tracking-wider text-success"
            style={{ opacity: yesOpacity }}
          >
            LIKE
          </span>
          <span
            aria-hidden
            className="absolute top-12 right-6 rotate-20 rounded-lg border-[5px] border-danger px-3 py-0.5 text-5xl font-extrabold tracking-wider text-danger"
            style={{ opacity: noOpacity }}
          >
            NOPE
          </span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(0_0_0/0.8)] via-[rgb(0_0_0/0.35)] to-transparent px-5 pt-24 pb-5">
            <p className={`text-[32px] leading-tight font-extrabold break-words ${white}`}>{name}</p>
            <p className="mt-1 text-sm font-medium text-[rgb(255_255_255/0.8)] tabular-nums">
              {done + 1} из {total}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          aria-label={`Нет: ${name}`}
          disabled={flying !== null}
          onClick={() => void answer(false)}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-danger shadow-[var(--shadow-soft)] transition duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
          style={{ transform: noOpacity > 0 ? `scale(${1 + noOpacity * 0.15})` : undefined }}
        >
          <X aria-hidden size={34} strokeWidth={3.2} />
        </button>
        <p aria-hidden className="flex flex-col items-center text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <ArrowLeft size={14} />
            нет · да
            <ArrowRight size={14} />
          </span>
        </p>
        <button
          type="button"
          aria-label={`Да: ${name}`}
          disabled={flying !== null}
          onClick={() => void answer(true)}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-success shadow-[var(--shadow-soft)] transition duration-150 hover:scale-105 active:scale-95 disabled:opacity-50"
          style={{ transform: yesOpacity > 0 ? `scale(${1 + yesOpacity * 0.15})` : undefined }}
        >
          <Heart aria-hidden size={32} strokeWidth={0} fill="currentColor" />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-center text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
