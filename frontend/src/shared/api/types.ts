export type BattleStatus = 'draft' | 'active' | 'finished' | 'stopped';
export type BattleMode = 'duel' | 'swipe';
// Swipe battles only: guests send photos first, then vote.
export type SwipePhase = 'collecting' | 'voting';
export type RoundState = 'running' | 'break';
export type MatchStatus = 'pending' | 'active' | 'finished';
export type DecidedBy = 'votes' | 'tie' | 'lot' | 'removal' | 'bye';

export interface Photo {
  id: number;
  url: string;
  caption: string | null;
  width: number;
  height: number;
}

export interface Match {
  id: number;
  round: number;
  slot: number;
  status: MatchStatus;
  photo_a: Photo | null;
  photo_b: Photo | null;
  ends_at: string | null;
  winner_id: number | null;
  decided_by: DecidedBy | null;
  total_votes: number;
  votes_a: number | null;
  votes_b: number | null;
  my_vote: number | null;
}

export interface Battle {
  id: number;
  title: string;
  theme: string;
  mode: BattleMode;
  phase: SwipePhase | null;
  status: BattleStatus;
  round_state: RoundState | null;
  current_round: number | null;
  total_rounds: number | null;
  round_ends_at: string | null;
  frozen: boolean;
  winner: Photo | null;
  joined: boolean;
  my_photo: Photo | null;
  participants: number;
  /** Фон экрана зала и телефонов; null — стандартный. */
  background_url?: string | null;
  server_time: string;
}

export interface Bracket {
  rounds: { round: number; matches: Match[] }[];
}

export interface AdminBattle extends Battle {
  round_seconds: number;
  freeze_seconds: number;
  auto_advance: boolean;
  photos: Photo[];
  bracket: Bracket;
  voters: number;
  swipers: number;
  standings: Standing[];
}

export interface Standing {
  photo: Photo;
  likes: number;
  dislikes: number;
  rank: number;
}

export interface Deck {
  photos: Photo[];
  total: number;
}

export interface AdminBattleSummary {
  id: number;
  title: string;
  theme: string;
  status: BattleStatus;
  mode: BattleMode;
  photo_count: number;
  created_at: string;
}

export interface OkResponse {
  ok: true;
}
