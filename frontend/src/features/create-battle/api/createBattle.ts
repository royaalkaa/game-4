import { apiUrl, request, type AdminBattle } from '@/shared/api';

export interface CreateBattleInput {
  title: string;
  theme: string;
  round_seconds: number;
  freeze_seconds: number;
  auto_advance: boolean;
}

export function createBattle(input: CreateBattleInput): Promise<AdminBattle> {
  return request<AdminBattle>(apiUrl('adminBattles'), { method: 'POST', body: input });
}
