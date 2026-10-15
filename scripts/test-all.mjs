import { spawnSync } from 'node:child_process';

const checks = ['scripts/test-token.mjs', 'scripts/test-pdf-stamp.mjs', 'scripts/test-validate.mjs', 'scripts/test-csv.mjs',
  'scripts/test-access.mjs', 'src/components/reading-room.test.cjs', 'scripts/test-commerce.mjs',
  'scripts/test-commerce-routes.mjs', 'scripts/test-commerce-db.mjs', 'scripts/test-publishing.mjs',
  'scripts/test-publishing-db.mjs', 'scripts/test-publishing-routes.mjs', 'scripts/test-auth.mjs', 'scripts/test-magic-link.mjs', 'scripts/test-recovery.mjs', 'scripts/test-migrations.mjs'];
for (const check of checks) {
  console.log(`\nChecking ${check}`);
  const result = spawnSync(process.execPath, ['--import', 'tsx', check], {
    stdio: 'inherit', env: { ...process.env, DATABASE_URL: '', RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '',
      RESEND_API_KEY: '', BLOB_READ_WRITE_TOKEN: '', COMMERCE_ENABLED: 'false' },
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('\nAll offline regression suites passed. No production credentials or services were used.');
