import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createIsolatedDatabase } from './isolated-db.mjs';

const port = Number(process.argv[2] || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port.');
const { db, directory } = await createIsolatedDatabase({ seed: true });
await db.close();
const preview = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(port)], {
  stdio: 'inherit', env: { ...process.env,
    PGLITE_DATABASE_DIR: directory, DATABASE_URL: '', AUTH_SECRET: randomBytes(32).toString('hex'),
    NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, NEXT_PUBLIC_STORE_NAME: 'Reading Room by INVENTAYU',
    COMMERCE_ENABLED: 'false', ALLOW_DEV_CHECKOUT: 'false', ADMIN_TOKEN: '', ADMIN_EMAIL: '',
    RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '', RAZORPAY_WEBHOOK_SECRET: '',
    RESEND_API_KEY: '', MAIL_FROM: '', BLOB_READ_WRITE_TOKEN: '', CRON_SECRET: '', DOWNLOAD_SECRET: '',
  },
});
console.log(`Isolated preview: http://localhost:${port}. Payments and outbound email are disabled.`);
process.on('SIGINT', () => preview.kill('SIGINT'));
preview.on('exit', code => process.exit(code ?? 0));
