import { netFetch } from './net.js';
export const ALERT_DAYS = 7;

export function tokenDaysLeft(expiresAt, now = new Date()) {
  return Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 86400000);
}

export const needsAlert = (expiresAt, now = new Date()) => tokenDaysLeft(expiresAt, now) < ALERT_DAYS;

// Renova o token longo (Instagram Login). Devolve o novo token e a data de expiração.
export async function refreshToken(token, { fetchImpl = netFetch, now = new Date() } = {}) {
  const res = await fetchImpl(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })}`);
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(`Falha ao renovar token: ${j.error?.message || res.status}`);
  return { token: j.access_token, expiresAt: new Date(now.getTime() + j.expires_in * 1000).toISOString() };
}
