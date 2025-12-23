export class ResidentialProxyManager {
  constructor() {
    this.proxies = [
      {
        host: "brd.superproxy.io",
        port: 22225,
        username: "brd-user-XXXX",
        password: "YYYY",
      },
    ];
    this.sessions = new Map();
  }

  /**
   * Create or reuse a sticky proxy session
   * @param {string} sessionId
   */
  getProxyForSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const base = this.proxies[0];

    const proxy = {
      server: `http://${base.host}:${base.port}`,
      username: `${base.username}-session-${sessionId}`,
      password: base.password,
    };

    this.sessions.set(sessionId, proxy);
    return proxy;
  }

  invalidateSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}
