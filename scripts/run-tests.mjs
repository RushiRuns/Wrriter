import { spawn } from 'node:child_process';
import path from 'node:path';
import electronPath from 'electron';

const vitestMjs = path.resolve(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
const args = [vitestMjs, ...process.argv.slice(2)];

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1'
  }
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
