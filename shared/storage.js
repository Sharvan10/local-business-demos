// Versioned localStorage store with migrations, JSON export/import and demo reset.
// Works in Node tests by passing a custom `backend` ({getItem,setItem,removeItem}).

export function memoryBackend() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/** Run migrations from data.__v up to `version`. migrations[n] upgrades n-1 -> n. Pure: returns a new object. */
export function migrate(data, version, migrations = {}) {
  let out = JSON.parse(JSON.stringify(data));
  let v = Number(out.__v || 1);
  if (v > version) throw new Error(`Data version ${v} is newer than this app (${version}).`);
  while (v < version) {
    const step = migrations[v + 1];
    if (step) out = step(out) || out;
    v += 1;
    out.__v = v;
  }
  out.__v = version;
  return out;
}

export function createStore({ key, version, seed, migrations = {}, backend }) {
  const be = backend || (typeof localStorage !== 'undefined' ? localStorage : memoryBackend());
  let cache = null;
  const listeners = new Set();

  function write(data) {
    cache = data;
    try { be.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('Storage full or blocked', e); }
    listeners.forEach((fn) => fn(cache));
  }
  function fresh() { const d = seed(); d.__v = version; d.__demo = true; d.__seededAt = new Date().toISOString(); return d; }

  function load() {
    if (cache) return cache;
    let raw = null;
    try { raw = be.getItem(key); } catch { /* blocked */ }
    if (!raw) { write(fresh()); return cache; }
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrate(parsed, version, migrations);
      if (migrated.__v !== parsed.__v) write(migrated); else cache = migrated;
    } catch (e) {
      console.warn('Stored data unreadable, reseeding', e);
      write(fresh());
    }
    return cache;
  }

  return {
    key, version,
    get data() { return load(); },
    load,
    save(data = cache) { write(data); },
    update(fn) { const d = load(); fn(d); write(d); return d; },
    reset() { write(fresh()); return cache; },
    reload() { cache = null; return load(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    exportJSON() {
      return JSON.stringify({ app: key, version, exportedAt: new Date().toISOString(), data: load() }, null, 2);
    },
    importJSON(text) {
      const obj = typeof text === 'string' ? JSON.parse(text) : text;
      if (!obj || typeof obj !== 'object' || !obj.data) throw new Error('Not a backup file');
      if (obj.app && obj.app !== key) throw new Error(`This backup belongs to "${obj.app}", not "${key}".`);
      const data = migrate({ __v: obj.version || obj.data.__v || 1, ...obj.data }, version, migrations);
      write(data);
      return data;
    },
  };
}

/** Read another app's store without seeding (e.g. public site reading owner data). */
export function peek(key, backend) {
  const be = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
  try { const raw = be && be.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
