export type BattleStatus = 'draft' | 'active' | 'finished' | 'stopped';
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
  status: BattleStatus;
  round_state: RoundState | null;
  current_round: number | null;
  total_rounds: number | null;
  round_ends_at: string | null;
  frozen: boolean;
  winner: Photo | null;
  joined: boolean;
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
}

export interface AdminBattleSummary {
  id: number;
  title: string;
  theme: string;
  status: BattleStatus;
  photo_count: number;
  created_at: string;
}

export interface OkResponse {
  ok: true;
}
