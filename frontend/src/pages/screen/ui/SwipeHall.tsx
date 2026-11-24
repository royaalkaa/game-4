import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Camera, Flame, Heart, Timer, Users, X } from 'lucide-react';
import type { AdminBattle, Photo } from '@/shared/api';
import { nameFit } from '@/shared/lib';
import { RoundTimer } from '@/entities/battle';
import { SwipeReveal } from '@/widgets/swipe-reveal';
import { JoinLinkText } from './JoinLinkText';

interface SwipeHallProps {
  battle: AdminBattle;
  battleId: string;
  offsetMs: number;
  qrSrc: string;
}

function TopBar({ battle, offsetMs }: { battle: AdminBattle; offsetMs: number }) {
  const voting = battle.status === 'active' && battle.phase === 'voting';
  const phase =
    battle.status === 'finished' ? 'Итоги' : battle.phase === 'collecting' ? 'Приём фото' : 'Голосование';
  return (
    <header className="flex items-center gap-6">
      <span className="bg-brand flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-[#fff] shadow-[0_0_40px_rgb(253_38_122/0.4)]">
        <Flame aria-hidden size={46} fill="currentColor" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-6xl leading-tight">{battle.title}</h1>
        {battle.theme && <p className="truncate text-3xl text-muted">{battle.theme}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="bg-brand rounded-full px-6 py-2 text-3xl font-extrabold text-[#fff]">{phase}</span>
        {voting && battle.round_ends_at && (
          <span className="inline-flex items-center gap-3 rounded-full bg-surface px-6 py-2 text-4xl font-extrabold">
            <Timer aria-hidden size={36} className="text-primary" />
            <RoundTimer endsAt={battle.round_ends_at} offsetMs={offsetMs} />
          </span>
        )}
      </div>
    </header>
  );
}

function QrPanel({ qrSrc, battleId, title, children }: { qrSrc: string; battleId: string; title: string; children?: ReactNode }) {
  return (
    <aside className="flex flex-col items-center gap-6 text-center">
      {/* A gradient frame makes the code the brightest thing on the dark screen. */}
      <div className="bg-brand rounded-[28px] p-2 shadow-[0_0_80px_rgb(253_38_122/0.35)]">
        <img src={qrSrc} alt="QR-код для входа" className="w-[380px] rounded-[22px] bg-qr p-5" />
      </div>
      <p className="text-5xl font-extrabold">{title}</p>
      {children}
      <JoinLinkText battleId={battleId} />
    </aside>
  );
}

function BigCount({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex items-baseline gap-4">
      <span className="text-brand text-9xl leading-none font-black tabular-nums">{value}</span>
      <span className="text-4xl font-bold text-muted">{label}</span>
    </p>
  );
}

function Steps() {
  const steps = ['Сфоткайся или выбери фото', 'Впиши имя', 'Жди голосования'];
  return (
    <ol className="flex flex-col gap-3 text-left text-3xl">
      {steps.map((text, index) => (
        <li key={text} className="flex items-center gap-4">
          <span className="bg-brand flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl font-black text-[#fff]">
            {index + 1}
          </span>
          {text}
        </li>
      ))}
    </ol>
  );
}

function PhotoCard({ photo, className = '' }: { photo: Photo; className?: string }) {
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-soft)] ${className}`}>
      <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(0_0_0/0.8)] to-transparent px-3 pt-12 pb-3">
        <span
          className={`line-clamp-3 leading-tight font-extrabold text-[#fff] ${
            { short: 'text-xl', medium: 'text-lg', long: 'text-base' }[nameFit(photo.caption ?? '')]
          }`}
        >
          {photo.caption ?? 'Без имени'}
        </span>
      </span>
    </div>
  );
}

function Collecting({ battle }: { battle: AdminBattle }) {
  const newestFirst = [...battle.photos].reverse();
  if (newestFirst.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <div className="relative flex h-80 w-80 items-center justify-center">
          {[0, 1, 2].map((ring) => (
            <span
              key={ring}
              aria-hidden
              className="bg-brand absolute inset-0 animate-[ping-ring_2.4s_ease-out_infinite] rounded-full"
              style={{ animationDelay: `${ring * 0.8}s` }}
            />
          ))}
          <span className="bg-brand relative flex h-40 w-40 items-center justify-center rounded-full text-[#fff]">
            <Camera aria-hidden size={72} />
          </span>
        </div>
        <p className="text-5xl font-extrabold">Ждём первые фото</p>
      </div>
    );
  }
  const width = newestFirst.length <= 6 ? 'w-[220px]' : newestFirst.length <= 12 ? 'w-[170px]' : 'w-[130px]';
  return (
    <div className="flex flex-1 flex-col gap-8">
      <BigCount value={battle.participants} label="в игре" />
      <ul className="flex flex-wrap gap-5">
        {newestFirst.map((photo) => (
          <li key={photo.id} className={`animate-[rise_0.6s_ease-out] ${width}`}>
            <PhotoCard photo={photo} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// A fanned stack of real participant cards, with the same stamps and buttons as on the phones.
function Voting({ battle }: { battle: AdminBattle }) {
  const fan = battle.photos.slice(0, 5);
  const middle = (fan.length - 1) / 2;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12">
      <div className="relative h-[42vh] w-full">
        {fan.map((photo, index) => {
          const offset = index - middle;
          return (
            <div
              key={photo.id}
              className="absolute top-0 left-1/2 h-full"
              style={{
                transform: `translateX(calc(-50% + ${offset * 150}px)) rotate(${offset * 7}deg)`,
                transformOrigin: 'bottom center',
                zIndex: 10 - Math.abs(Math.round(offset)),
              }}
            >
              <PhotoCard photo={photo} className="h-full" />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-14">
        <span className="inline-flex items-center gap-5 text-5xl font-extrabold text-danger">
          <ArrowLeft aria-hidden size={52} />
          нет
          <span className="flex h-28 w-28 items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-soft)]">
            <X aria-hidden size={60} strokeWidth={3.2} />
          </span>
        </span>
        <span className="inline-flex items-center gap-5 text-5xl font-extrabold text-success">
          <span className="flex h-28 w-28 items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-soft)]">
            <Heart aria-hidden size={56} strokeWidth={0} fill="currentColor" />
          </span>
          да
          <ArrowRight aria-hidden size={52} />
        </span>
      </div>
    </div>
  );
}

// The hall never shows live counts during voting: guests would follow the leader.
export function SwipeHall({ battle, battleId, offsetMs, qrSrc }: SwipeHallProps) {
  if (battle.status === 'finished') {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-6">
        <TopBar battle={battle} offsetMs={offsetMs} />
        <div className="flex flex-1 items-center justify-center">
          <SwipeReveal large entries={battle.standings} />
        </div>
      </div>
    );
  }

  const collecting = battle.phase === 'collecting';
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-12">
      <TopBar battle={battle} offsetMs={offsetMs} />
      <div className="flex flex-1 gap-16">
        <QrPanel qrSrc={qrSrc} battleId={battleId} title={collecting ? 'Сканируй и загрузи фото' : 'Сканируй и голосуй'}>
          {collecting ? (
            <Steps />
          ) : (
            <p className="text-3xl text-muted">
              Проголосовало: <span className="font-extrabold text-fg">{battle.swipers}</span>
            </p>
          )}
          <p className="inline-flex items-center gap-3 text-2xl text-muted">
            <Users aria-hidden size={28} />
            Вошло: {battle.voters}
          </p>
        </QrPanel>
        {collecting ? <Collecting battle={battle} /> : <Voting battle={battle} />}
      </div>
    </div>
  );
}
