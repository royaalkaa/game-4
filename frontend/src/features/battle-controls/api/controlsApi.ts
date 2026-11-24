import { apiUrl, request, type AdminBattle } from '@/shared/api';

function post(url: string, body?: unknown): Promise<AdminBattle> {
  return request<AdminBattle>(url, { method: 'POST', body });
}

export const startBattle = (battleId: string) => post(apiUrl('adminStart', { battleId }));
// The round number lets the server refuse to close a round that auto-advance started meanwhile.
export const finishRound = (battleId: string, round: number) =>
  post(apiUrl('adminFinishRound', { battleId }), { round });
export const nextRound = (battleId: string) => post(apiUrl('adminNextRound', { battleId }));
export const stopBattle = (battleId: string) => post(apiUrl('adminStop', { battleId }));
export const removePhoto = (battleId: string, photoId: number) =>
  post(apiUrl('adminRemovePhoto', { battleId, photoId }));
export const startVoting = (battleId: string) => post(apiUrl('adminStartVoting', { battleId }));
