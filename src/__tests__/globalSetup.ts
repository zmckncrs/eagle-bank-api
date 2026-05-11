import { execSync } from 'child_process';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../../');
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  });
}
