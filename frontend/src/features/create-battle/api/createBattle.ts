import { apiUrl, request, type AdminBattle, type BattleMode } from '@/shared/api';

export interface CreateBattleInput {
  title: string;
  theme: string;
  round_seconds: number;
  freeze_seconds: number;
  auto_advance: boolean;
  mode: BattleMode;
}

export function createBattle(input: CreateBattleInput): Promise<AdminBattle> {
  return request<AdminBattle>(apiUrl('adminBattles'), { method: 'POST', body: input });
}
