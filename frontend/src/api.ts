export interface Note {
  id: number;
  noteKey: string;
  readOnlyUrl: string | null;
  content: string;
  lastUpdateTs: string;
  hasPassword: boolean;
  locked: boolean;
}

export class InvalidPasswordError extends Error { constructor() { super('invalid'); } }
export class KeyTakenError extends Error { constructor() { super('taken'); } }
export class RateLimitedError extends Error { constructor() { super('rate-limited'); } }

async function req(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const r = await fetch(input, init);
  if (r.status === 429) throw new RateLimitedError();
  return r;
}

export async function loadOrCreate(key?: string): Promise<Note> {
  const path = '/' + (key ? encodeURIComponent(key) : '');
  const r = await req(path, { method: 'POST' });
  if (!r.ok) throw new Error(`load ${r.status}`);
  return r.json();
}

export async function unlock(key: string, password: string): Promise<Note> {
  const r = await req(`/${encodeURIComponent(key)}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (r.status === 401) throw new InvalidPasswordError();
  if (!r.ok) throw new Error(`unlock ${r.status}`);
  return r.json();
}

export async function setNoteKey(key: string): Promise<void> {
  const r = await req('/set-noteKey', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (r.status === 409) throw new KeyTakenError();
  if (!r.ok) throw new Error(`set-noteKey ${r.status}`);
}

export async function setPassword(password: string, currentPassword?: string): Promise<void> {
  const r = await req('/set-password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, currentPassword }),
  });
  if (r.status === 401) throw new InvalidPasswordError();
  if (!r.ok) throw new Error(`set-password ${r.status}`);
}

export async function generateShare(): Promise<string> {
  const r = await req('/generate-share', { method: 'POST' });
  if (!r.ok) throw new Error(`share ${r.status}`);
  const j = await r.json();
  return j.readOnlyUrl;
}

export async function loadShare(roUrl: string): Promise<Note> {
  const r = await req(`/share/${encodeURIComponent(roUrl)}`, { method: 'POST' });
  if (!r.ok) throw new Error(`share load ${r.status}`);
  return r.json();
}

