import { apiUrl, request, type OkResponse } from '@/shared/api';

export function joinBattle(battleId: string, code: string): Promise<OkResponse> {
  return request<OkResponse>(apiUrl('join', { battleId }), { method: 'POST', body: { code } });
}
