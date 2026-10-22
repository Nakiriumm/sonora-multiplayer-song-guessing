import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = join(tmpdir(), 'sonora-wrangler');
const env = {
  ...process.env,
  XDG_CONFIG_HOME: join(tempDir, 'config'),
};
const args = [
  'dev',
  '--ip', '127.0.0.1',
  '--port', '8000',
  '--persist-to', join(tempDir, 'state'),
];
const wrangler = spawn(join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'), args, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

wrangler.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
