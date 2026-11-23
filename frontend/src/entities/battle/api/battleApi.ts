import {
  apiUrl,
  request,
  type AdminBattle,
  type AdminBattleSummary,
  type Battle,
  type Bracket,
} from '@/shared/api';

export function getBattle(battleId: string): Promise<Battle> {
  return request<Battle>(apiUrl('battle', { battleId }));
}

export function getBracket(battleId: string): Promise<Bracket> {
  return request<Bracket>(apiUrl('bracket', { battleId }));
}

export function getAdminBattle(battleId: string): Promise<AdminBattle> {
  return request<AdminBattle>(apiUrl('adminBattle', { battleId }));
}

export function listAdminBattles(): Promise<AdminBattleSummary[]> {
  return request<AdminBattleSummary[]>(apiUrl('adminBattles'));
}

export interface JoinLink {
  url: string;
  valid_until: string;
}

export function getJoinLink(battleId: string): Promise<JoinLink> {
  return request<JoinLink>(apiUrl('adminJoinLink', { battleId }));
}
