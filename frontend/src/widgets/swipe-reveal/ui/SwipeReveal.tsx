import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Crown, Heart } from 'lucide-react';
import type { Standing } from '@/shared/api';
import { nameFit } from '@/shared/lib';
import { lastStep, revealAt, revealOrder, tickMs } from '../model/reveal';

// A short pause before the count so the hall sees everyone at zero first.
const START_DELAY_MS = 1200;
const CONFETTI = 22;

interface SwipeRevealProps {
  entries: Standing[];
  large?: boolean;
  // Shown only after the count, so a place or a table does not give the winner away early.
  after?: ReactNode;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Fewer guests get bigger cards, so four photos fill the projector and forty still fit.
function cardWidth(count: number, large: boolean): string {
  if (!large) return count <= 4 ? 'w-[calc(50%-0.5rem)]' : 'w-[calc(33.333%-0.5rem)]';
  if (count <= 4) return 'w-[260px]';
  if (count <= 8) return 'w-[210px]';
  if (count <= 15) return 'w-[170px]';
  return 'w-[130px]';
}

function podiumName(name: string, large: boolean, winner: boolean): string {
  const fit = nameFit(name);
  if (!large) return fit === 'short' ? 'text-sm' : 'text-[11px]';
  if (fit === 'long') return winner ? 'text-2xl' : 'text-xl';
  if (fit === 'medium') return winner ? 'text-3xl' : 'text-2xl';
  return winner ? 'text-4xl' : 'text-3xl';
}

function cardName(name: string, large: boolean): string {
  const fit = nameFit(name);
  if (!large) return fit === 'short' ? 'text-xs' : 'text-[10px]';
  return { short: 'text-xl', medium: 'text-lg', long: 'text-base' }[fit];
}

function Likes({ value, size }: { value: number; size: 'sm' | 'md' | 'lg' }) {
  const text = { sm: 'text-sm', md: 'text-2xl', lg: 'text-5xl' }[size];
  const icon = { sm: 13, md: 22, lg: 44 }[size];
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold text-danger tabular-nums ${text}`}>
      <Heart aria-hidden fill="currentColor" strokeWidth={0} size={icon} />
      {value}
    </span>
  );
}

interface PodiumProps {
  entries: Standing[];
  large: boolean;
}

// Places 2, 1, 3 left to right; the winner stands highest, in the middle.
function Podium({ entries, large }: PodiumProps) {
  const [first, second, third] = entries;
  if (!first) return null;
  const places = [
    { entry: second, place: 2, photo: large ? 'h-[30vh]' : 'h-32', step: large ? 'h-[9vh]' : 'h-10' },
    { entry: first, place: 1, photo: large ? 'h-[40vh]' : 'h-44', step: large ? 'h-[14vh]' : 'h-16' },
    { entry: third, place: 3, photo: large ? 'h-[26vh]' : 'h-28', step: large ? 'h-[6vh]' : 'h-7' },
  ];

  return (
    <div className="relative flex w-full items-end justify-center gap-3 sm:gap-6" data-testid="podium">
      {places.map(({ entry, place, photo, step }) => {
        if (!entry) return <div key={place} className={large ? 'w-[30vh]' : 'w-1/3'} />;
        const winner = place === 1;
        return (
          <div
            key={entry.photo.id}
            className={`flex animate-[rise_0.7s_ease-out_both] flex-col items-center ${
              large ? (winner ? 'w-[36vh]' : 'w-[30vh]') : 'w-1/3'
            }`}
            style={{ animationDelay: `${winner ? 0.5 : place === 2 ? 0.2 : 0}s` }}
          >
            <div className={`relative w-full ${photo}`}>
              {winner && (
                <>
                  <div className="pointer-events-none absolute top-1/3 left-1/2 z-10" aria-hidden>
                    {Array.from({ length: CONFETTI }, (_, piece) => (
                      <span
                        key={piece}
                        className={`absolute block h-3 w-2 animate-[burst_1.6s_ease-out_0.6s_forwards] rounded-sm opacity-0 ${
                          piece % 3 === 0 ? 'bg-primary' : piece % 3 === 1 ? 'bg-accent' : 'bg-[#ffd23f]'
                        }`}
                        style={
                          {
                            '--angle': `${(360 / CONFETTI) * piece}deg`,
                            '--reach': large ? '46vh' : '180px',
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <Crown
                    aria-label="1 место"
                    className={`absolute left-1/2 z-10 -translate-x-1/2 text-[#ffd23f] ${large ? '-top-16' : '-top-8'}`}
                    size={large ? 64 : 32}
                    fill="currentColor"
                  />
                </>
              )}
              <div
                className={`h-full w-full overflow-hidden rounded-lg ${
                  winner ? 'bg-brand p-1 shadow-[0_0_60px_rgb(253_38_122/0.45)]' : 'bg-surface p-0.5'
                }`}
              >
                <img
                  src={entry.photo.url}
                  alt={entry.photo.caption ?? `Место ${place}`}
                  className="h-full w-full rounded-md object-cover"
                />
              </div>
            </div>
            {/* Full names wrap onto a second line instead of being cut. */}
            <p
              className={`mt-2 line-clamp-3 w-full text-center leading-tight font-extrabold ${podiumName(
                entry.photo.caption ?? '',
                large,
                winner,
              )}`}
            >
              {entry.photo.caption ?? 'Без имени'}
            </p>
            <Likes value={entry.likes} size={large ? (winner ? 'lg' : 'md') : 'sm'} />
            <div
              className={`mt-2 flex w-full items-start justify-center rounded-t-lg pt-1 font-black ${step} ${
                winner ? 'bg-brand text-[#fff]' : 'bg-surface text-muted'
              } ${large ? 'text-5xl' : 'text-lg'}`}
            >
              {place}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SwipeReveal({ entries, large = false, after }: SwipeRevealProps) {
  const ordered = useMemo(() => revealOrder(entries), [entries]);
  const final = lastStep(entries);
  const [step, setStep] = useState(() => (prefersReducedMotion() ? final : 0));

  useEffect(() => {
    if (step >= final) return;
    const timer = setTimeout(() => setStep((value) => value + 1), step === 0 ? START_DELAY_MS : tickMs(entries));
    return () => clearTimeout(timer);
  }, [step, final, entries]);

  const cards = revealAt(ordered, step);
  const finished = step >= final;
  const inGame = cards.filter((card) => !card.out).length;

  if (entries.length === 0) {
    return <p className={`text-center text-muted ${large ? 'text-4xl' : ''}`}>Никто не прислал фото</p>;
  }

  return (
    <section aria-label="Подсчёт голосов" className={`flex w-full flex-col items-center ${large ? 'gap-10' : 'gap-8'}`}>
      <p
        aria-live="polite"
        className={
          finished
            ? // Big slanted gradient title, like the screen after a mutual like.
              `text-brand px-2 text-center font-black italic ${large ? 'text-8xl' : 'text-5xl'}`
            : `text-center font-extrabold ${large ? 'text-6xl' : 'text-2xl'}`
        }
      >
        {finished ? 'Победитель!' : step === 0 ? 'Считаем голоса…' : `В игре: ${inGame}`}
      </p>

      {finished ? (
        <>
          <Podium entries={entries} large={large} />
          {after}
        </>
      ) : (
        <ul className={`flex w-full flex-wrap justify-center ${large ? 'gap-6' : 'gap-3'}`}>
          {cards.map((card) => (
            <li
              key={card.standing.photo.id}
              data-testid={`reveal-${card.standing.photo.id}`}
              data-out={card.out}
              className={`relative aspect-[3/4] overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-soft)] transition-all duration-700 ${cardWidth(
                cards.length,
                large,
              )} ${card.out ? 'scale-90 opacity-30 grayscale' : ''}`}
            >
              <img src={card.standing.photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-[rgb(0_0_0/0.8)] to-transparent px-3 pt-10 pb-2">
                <span
                  className={`line-clamp-3 min-w-0 leading-tight font-bold text-[#fff] ${cardName(
                    card.standing.photo.caption ?? '',
                    large,
                  )}`}
                >
                  {card.standing.photo.caption ?? 'Без имени'}
                </span>
                <span
                  key={card.shown}
                  className={`inline-flex shrink-0 animate-[pop_0.25s_ease-out] items-center gap-1 rounded-full bg-[#fff] px-2 py-0.5 font-extrabold text-danger tabular-nums ${
                    large ? 'text-2xl' : 'text-xs'
                  }`}
                >
                  <Heart aria-hidden fill="currentColor" strokeWidth={0} size={large ? 20 : 11} />
                  {card.shown}
                </span>
              </div>
              {card.out && (
                <span
                  className={`absolute top-3 left-3 -rotate-12 rounded-md border-[3px] border-danger bg-[rgb(255_255_255/0.9)] px-2 font-extrabold tracking-wider text-danger ${
                    large ? 'text-2xl' : 'text-xs'
                  }`}
                >
                  ВЫБЫЛ
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
