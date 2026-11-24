import { apiUrl, request, uploadForm, type AdminBattle } from '@/shared/api';

export function setBackground(
  battleId: string | number,
  file: File,
  onProgress: (fraction: number) => void = () => undefined,
): Promise<AdminBattle> {
  const form = new FormData();
  form.append('file', file);
  return uploadForm<AdminBattle>(apiUrl('adminBackground', { battleId }), form, onProgress, 'PUT');
}

export function clearBackground(battleId: string | number): Promise<AdminBattle> {
  return request<AdminBattle>(apiUrl('adminBackground', { battleId }), { method: 'DELETE' });
}
