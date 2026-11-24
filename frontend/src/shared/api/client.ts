import { generatePath } from 'react-router';
import { apiPaths } from '@/shared/config';

type ApiPathKey = keyof typeof apiPaths;

export const NETWORK_ERROR_CODE = 'network_error';

const NETWORK_ERROR_MESSAGE = 'Нет связи с сервером. Проверь интернет и попробуй ещё раз';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(key: ApiPathKey, params: Record<string, string | number> = {}): string {
  const stringParams: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) stringParams[name] = String(value);
  return generatePath(apiPaths[key], stringParams);
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, 'unknown', 'Что-то пошло не так. Попробуй ещё раз');
}

function parseJson(text: string): unknown {
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorFromBody(status: number, body: unknown): ApiError {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = body.error;
    if (typeof error === 'object' && error !== null) {
      const { code, message } = error as { code?: unknown; message?: unknown };
      if (typeof code === 'string' && typeof message === 'string') {
        return new ApiError(status, code, message);
      }
    }
  }
  return new ApiError(status, 'http_error', `Сервер ответил ошибкой ${status}. Попробуй ещё раз`);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_CODE, NETWORK_ERROR_MESSAGE);
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new ApiError(0, NETWORK_ERROR_CODE, NETWORK_ERROR_MESSAGE);
  }
  const data = parseJson(text);
  if (!response.ok) throw errorFromBody(response.status, data);
  return data as T;
}

// fetch does not report upload progress, so file uploads go through XMLHttpRequest.
export function uploadForm<T>(
  url: string,
  form: FormData,
  onProgress: (fraction: number) => void,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const data = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(data as T);
      } else {
        reject(errorFromBody(xhr.status, data));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_ERROR_CODE, NETWORK_ERROR_MESSAGE));
    xhr.send(form);
  });
}
