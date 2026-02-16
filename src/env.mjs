export function parseCommaList(value) {
  const raw = (value || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getEnvString(env, key) {
  const v = env && Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
  if (v == null) return "";
  return String(v);
}

export function getEnvStringAny(env, keys) {
  for (const k of keys) {
    const v = getEnvString(env, k);
    if (v.trim()) return v;
  }
  return "";
}

export function getEnvBool(env, key) {
  const v = getEnvString(env, key).trim().toLowerCase();
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes";
}

export function getEnvInt(env, key, fallback) {
  const v = getEnvString(env, key).trim();
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}
