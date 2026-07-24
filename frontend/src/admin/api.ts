import type { NoteSummary } from './dom';

export async function fetchNotes(): Promise<Response> {
  return fetch('/admin/notes');
}

export async function fetchStatus(): Promise<{ enabled: boolean; loggedIn: boolean }> {
  const r = await fetch('/admin/status');
  return r.json();
}

export async function apiLogin(password: string): Promise<Response> {
  return fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function apiLogout(): Promise<void> {
  await fetch('/admin/logout', { method: 'POST' });
}

export async function apiDelete(keys: string[]): Promise<Response> {
  return fetch('/admin/notes/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
}

export async function apiGetContent(key: string): Promise<Response> {
  return fetch(`/admin/notes/${encodeURIComponent(key)}/content`);
}

export async function apiSetPassword(key: string, password: string): Promise<Response> {
  return fetch(`/admin/notes/${encodeURIComponent(key)}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export type { NoteSummary };
