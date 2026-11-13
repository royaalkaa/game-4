import { apiUrl, request, uploadForm, type OkResponse, type Photo } from '@/shared/api';

export function uploadPhoto(
  battleId: string,
  file: File,
  caption: string,
  onProgress: (fraction: number) => void,
): Promise<Photo> {
  const form = new FormData();
  form.append('file', file);
  if (caption !== '') form.append('caption', caption);
  return uploadForm<Photo>(apiUrl('adminPhotos', { battleId }), form, onProgress);
}

export function deletePhoto(battleId: string, photoId: number): Promise<OkResponse> {
  return request<OkResponse>(apiUrl('adminPhoto', { battleId, photoId }), { method: 'DELETE' });
}
