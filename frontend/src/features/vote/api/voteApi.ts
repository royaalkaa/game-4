import { apiUrl, request, type Match } from '@/shared/api';

export function getNextMatch(battleId: string): Promise<{ match: Match | null }> {
  return request<{ match: Match | null }>(apiUrl('nextMatch', { battleId }));
}

export function castVote(matchId: number, photoId: number): Promise<Match> {
  return request<Match>(apiUrl('vote', { matchId }), { method: 'POST', body: { photo_id: photoId } });
}
