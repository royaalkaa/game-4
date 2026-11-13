import { apiUrl, request, type OkResponse } from '@/shared/api';

export function getAdminMe(): Promise<{ admin: true }> {
  return request<{ admin: true }>(apiUrl('adminMe'));
}

export function adminLogin(password: string): Promise<OkResponse> {
  return request<OkResponse>(apiUrl('adminLogin'), { method: 'POST', body: { password } });
}
