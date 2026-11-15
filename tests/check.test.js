import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, formatChecks } from '../src/check.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const env = { GEMINI_KEY: 'GEMINIKEY12345', TG_TOKEN: 'TGTOKEN12345', TG_CHAT_ID: '1', IG_TOKEN: 'IGTOKEN12345', IG_USER_ID: '178', GH_ADMIN_TOKEN: 'GHTOKEN12345', GITHUB_REPOSITORY: 'o/r' };
const routes = (over = {}) => async (url) => {
  if (url.includes('generativelanguage')) return over.gemini ?? ok({});
  if (url.includes('api.telegram.org')) return over.tg ?? ok({ ok: true, result: { username: 'esm_bot' } });
  if (url.includes('graph.instagram.com')) return over.ig ?? ok({ user_id: '178', username: 'esm_web', account_type: 'BUSINESS' });
  if (url.includes('api.github.com')) return over.gh ?? ok({});
  throw new Error('url inesperada');
};

test('check: everything configured gives all green and the next step', async () => {
  const r = await runChecks({ env, fetchImpl: routes() });
  assert.equal(r.length, 4);
  assert.ok(r.every((x) => x.ok));
  assert.ok(formatChecks(r).includes('Tudo pronto'));
});
test('check: missing Instagram keys are reported, not thrown', async () => {
  const r = await runChecks({ env: { ...env, IG_TOKEN: '', IG_USER_ID: '' }, fetchImpl: routes() });
  const ig = r.find((x) => x.name.startsWith('Instagram'));
  assert.equal(ig.ok, false);
  assert.ok(ig.detail.includes('não cadastrados'));
  assert.ok(formatChecks(r).includes('Corrija'));
});
test('check: wrong account id, personal account and rejected tokens are explained', async () => {
  let r = await runChecks({ env, fetchImpl: routes({ ig: ok({ user_id: '999', username: 'x', account_type: 'BUSINESS' }) }) });
  assert.ok(r.find((x) => x.name.startsWith('Instagram')).detail.includes('IG_USER_ID'));
  r = await runChecks({ env, fetchImpl: routes({ ig: ok({ user_id: '178', username: 'x', account_type: 'PERSONAL' }) }) });
  assert.ok(r.find((x) => x.name.startsWith('Instagram')).detail.includes('Profissional'));
  r = await runChecks({ env, fetchImpl: routes({ gh: { ok: false, status: 403, json: async () => ({}) } }) });
  assert.ok(r.find((x) => x.name.startsWith('Renovação')).detail.includes('Secrets'));
});
test('check: no secret ever appears in the report', async () => {
  const boom = async () => { throw new Error('falha com IGTOKEN12345 e GHTOKEN12345 e GEMINIKEY12345'); };
  const text = formatChecks(await runChecks({ env, fetchImpl: boom }));
  for (const v of ['IGTOKEN12345', 'GHTOKEN12345', 'GEMINIKEY12345', 'TGTOKEN12345']) assert.ok(!text.includes(v), v);
});
