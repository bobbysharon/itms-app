/* SMART ITMS API Client — replaces localStorage with backend API */
(function () {
  const ITMS = window.ITMS;
  const API_BASE = '';  // same origin

  function getToken() { try { return localStorage.getItem('itms.token') || sessionStorage.getItem('itms.token'); } catch (e) { return null; } }
  function setToken(t) { try { sessionStorage.setItem('itms.token', t); localStorage.setItem('itms.token', t); } catch (e) { /* ignore */ } }
  function clearToken() { try { sessionStorage.removeItem('itms.token'); localStorage.removeItem('itms.token'); } catch (e) { /* ignore */ } }

  async function request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) { clearToken(); location.reload(); return null; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  ITMS.api = {
    token: getToken,
    setToken: setToken,
    clearToken: clearToken,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
    health: () => request('GET', '/api/health'),
    login: (email, password) => request('POST', '/api/auth/login', { email, password }),
    me: () => request('GET', '/api/auth/me'),
    sync: (table, data) => request('POST', '/api/data/sync', { table, data }),
    getAll: (table) => request('GET', '/api/data/' + table),
    save: (table, data) => request('POST', '/api/data/' + table, data),
    delete: (table, id) => request('DELETE', '/api/data/' + table + '/' + id),
    finance: {
      coa: () => request('GET', '/api/data/finance/coa'),
      jv: () => request('GET', '/api/data/finance/jv'),
      expenses: () => request('GET', '/api/data/finance/expenses'),
      payments: () => request('GET', '/api/data/finance/payments'),
      config: () => request('GET', '/api/data/finance/config'),
    },
  };

  // Auto-sync all localStorage data to backend on first load
  ITMS.api.syncAll = async function () {
    const S = ITMS.store;
    const db = S.db;
    if (!db) return;
    const tables = ['employees', 'tickets', 'hardware', 'software', 'consumables', 'vendors', 'purchase_orders', 'grns', 'invoices', 'amcs', 'contracts', 'items'];
    for (const table of tables) {
      const data = db[table] || [];
      if (data.length > 0) {
        try { await ITMS.api.sync(table, data); } catch (e) { console.warn('Sync failed for ' + table, e); }
      }
    }
    try { await ITMS.api.sync('finance_jv', db.sdp?.fin?.jv || []); } catch (e) { /* ignore */ }
    try { await ITMS.api.sync('finance_expenses', db.sdp?.fin?.expenses || []); } catch (e) { /* ignore */ }
    try { await ITMS.api.sync('finance_payments', db.sdp?.fin?.payments || []); } catch (e) { /* ignore */ }
  };
})();
