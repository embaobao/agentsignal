process.env.LOG_LEVEL='silent';
process.env.DATABASE_URL='postgres://test:test@localhost:5432/test';
const { createTestDb } = await import('./test/helpers/testdb.ts');
const { buildApp } = await import('./src/server.ts');
const { hashSync } = await import('bcryptjs');
const t = await createTestDb();
const app = await buildApp({ db: t.db, env: {
  RATE_LIMIT_READ_MAX: '100000', RATE_LIMIT_WRITE_MAX: '100000', RATE_LIMIT_REGISTER_MAX: '100000',
  SELF_REGISTER_ENABLED: '1', AS_ADMIN_USER: 'admin', AS_ADMIN_PASS_BCRYPT: hashSync('admin-pass', 10),
}});
const reg = await app.inject({ method: 'POST', url: '/agents/register', headers: {'content-type':'application/json'}, payload: JSON.stringify({name:'auditor'}) });
console.log('register:', reg.statusCode, reg.body.slice(0, 200));
const token = reg.json().token;
const p = await app.inject({ method: 'POST', url: '/topics/audit/signals', headers: {'content-type':'application/json', authorization:`Bearer ${token}`}, payload: JSON.stringify({kind:'solution', digest:'审计探测专用 digest | scope: test | validation: none #1'}) });
console.log('publish:', p.statusCode, p.body.slice(0, 200));
await app.close(); await t.dispose();
