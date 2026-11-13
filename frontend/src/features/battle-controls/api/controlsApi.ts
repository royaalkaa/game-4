import { apiUrl, request, type AdminBattle } from '@/shared/api';

function post(url: string): Promise<AdminBattle> {
  return request<AdminBattle>(url, { method: 'POST' });
}

export const startBattle = (battleId: string) => post(apiUrl('adminStart', { battleId }));
export const finishRound = (battleId: string) => post(apiUrl('adminFinishRound', { battleId }));
export const nextRound = (battleId: string) => post(apiUrl('adminNextRound', { battleId }));
export const stopBattle = (battleId: string) => post(apiUrl('adminStop', { battleId }));
export const removePhoto = (battleId: string, photoId: number) =>
  post(apiUrl('adminRemovePhoto', { battleId, photoId }));
