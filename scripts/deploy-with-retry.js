import { spawn } from 'node:child_process';

const maxAttempts = 3;
const retryableFailure = /\b504\b|malformed response from the API/i;
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runWranglerDeploy() {
  return new Promise((resolve) => {
    const child = spawn(command, ['wrangler', 'deploy'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let output = '';

    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', (chunk) => {
        destination.write(chunk);
        output = (output + chunk.toString()).slice(-50000);
      });
    }

    child.on('error', (error) => {
      console.error(`Could not start Wrangler: ${error.message}`);
      resolve({ code: 1, output });
    });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = await runWranglerDeploy();
  if (result.code === 0) {
    process.exitCode = 0;
    break;
  }

  if (attempt === maxAttempts || !retryableFailure.test(result.output)) {
    process.exitCode = result.code;
    break;
  }

  const delayMs = attempt * 10000;
  console.warn(`Cloudflare returned a transient API error. Retrying deploy (${attempt + 1}/${maxAttempts}) in ${delayMs / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
