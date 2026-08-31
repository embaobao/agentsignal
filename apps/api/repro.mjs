process.env.LOG_LEVEL='silent';
process.env.DATABASE_URL='postgres://test:test@localhost:5432/test';
const { createTestDb } = await import('/Users/embaobao/workspace/agentsignal/apps/api/test/helpers/testdb.ts');
const { buildApp } = await import('/Users/embaobao/workspace/agentsignal/apps/api/src/server.ts');
const { hashSync } = await import('bcryptjs');
try {
  const t = await createTestDb();
  const app = await buildApp({ db: t.db, env: { RATE_LIMIT_READ_MAX: '100000', RATE_LIMIT_WRITE_MAX: '100000', RATE_LIMIT_REGISTER_MAX: '100000', SELF_REGISTER_ENABLED: '1', AS_ADMIN_USER: 'admin', AS_ADMIN_PASS_BCRYPT: hashSync('admin-pass', 10) } });
  console.log('BUILD OK');
  await app.close(); await t.dispose();
} catch (e) { console.error('REAL ERROR:', e?.message ?? e); console.error(e?.stack?.split('\n').slice(0,4).join('\n')); }
