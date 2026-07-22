export type WsState = 'connecting' | 'open' | 'closed' | 'unauthorized';

export class NoteSocket {
  private sock?: WebSocket;
  private currentKey?: string;
  private retryMs = 0;
  private retryTimer?: number;
  private closedByUser = false;
  private authFailed = false;
  private pending?: string;
  onState: (s: WsState) => void = () => {};
  onMessage: (text: string) => void = () => {};

  connect(noteKey: string): void {
    this.closedByUser = false;
    this.authFailed = false;
    this.currentKey = noteKey;
    this.retryMs = 0;
    this.open();
  }

  private open(): void {
    if (!this.currentKey) return;
    this.stopSocket();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws/${encodeURIComponent(this.currentKey)}`;
    this.onState('connecting');
    const s = new WebSocket(url);
    s.onopen = () => {
      this.retryMs = 0;
      this.onState('open');
      if (this.pending !== undefined) {
        const p = this.pending;
        this.pending = undefined;
        try { s.send(p); } catch { this.pending = p; }
      }
    };
    s.onmessage = (e) => this.onMessage(String(e.data));
    s.onerror = () => {};
    s.onclose = (e) => {
      // 1008 = policy violation (session mismatch) — don't retry
      if (e.code === 1008) {
        this.authFailed = true;
        this.onState('unauthorized');
        return;
      }
      if (this.closedByUser) return;
      this.onState('closed');
      this.scheduleRetry();
    };
    this.sock = s;
  }

  private scheduleRetry(): void {
    this.retryMs = this.retryMs === 0 ? 500 : Math.min(this.retryMs * 2, 15000);
    clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => this.open(), this.retryMs);
  }

  send(text: string): boolean {
    if (this.authFailed) return false;
    if (this.sock?.readyState === WebSocket.OPEN) {
      this.sock.send(text);
      return true;
    }
    // buffer latest; will flush on open
    this.pending = text;
    return false;
  }

  close(): void {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    this.stopSocket();
    this.currentKey = undefined;
    this.pending = undefined;
  }

  private stopSocket(): void {
    if (this.sock) {
      try { this.sock.onclose = null; this.sock.close(); } catch {}
      this.sock = undefined;
    }
  }
}

