import { API_BASE_URL } from './api-config';
import { STORAGE_KEYS } from './storageKeys';

/**
 * Upload a file to the backend and return a fully-qualified URL to the saved file.
 * Replaces the old FileReader.readAsDataURL() approach — no more giant base64
 * strings in the database or API responses.
 *
 * Returns a URL like: http://127.0.0.1:8000/static/uploads/<uuid>.jpg
 * The DB stores this short path; all existing base64 values still render fine.
 */
export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed: ${text}`);
  }

  const { url } = await res.json() as { url: string };
  // url is a root-relative path like "/static/uploads/abc.jpg"
  return `${API_BASE_URL}${url}`;
}
