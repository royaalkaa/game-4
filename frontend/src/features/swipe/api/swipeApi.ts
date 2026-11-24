import { apiUrl, request, type Deck, type OkResponse } from '@/shared/api';

export function getDeck(battleId: string): Promise<Deck> {
  return request<Deck>(apiUrl('deck', { battleId }));
}

export function sendSwipe(photoId: number, liked: boolean): Promise<OkResponse> {
  return request<OkResponse>(apiUrl('swipe', { photoId }), { method: 'POST', body: { liked } });
}
