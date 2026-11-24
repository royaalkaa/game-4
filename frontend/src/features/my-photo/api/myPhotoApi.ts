import { apiUrl, request, uploadForm, type OkResponse, type Photo } from '@/shared/api';

export function uploadMyPhoto(
  battleId: string,
  file: File,
  name: string,
  onProgress: (fraction: number) => void,
): Promise<Photo> {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  return uploadForm<Photo>(apiUrl('myPhoto', { battleId }), form, onProgress);
}

export function deleteMyPhoto(battleId: string): Promise<OkResponse> {
  return request<OkResponse>(apiUrl('myPhoto', { battleId }), { method: 'DELETE' });
}
