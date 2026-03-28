import { spawn } from 'node:child_process';

const children = new Set();

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  children.add(child);

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (signal) {
      console.log(`[${name}] exited from signal ${signal}`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });

  child.on('error', (error) => {
    console.error(`[${name}] failed to start`, error);
    shutdown(1);
  });

  return child;
}

function runAndWait(name, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${name} exited from signal ${signal}`));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`${name} exited with code ${code}`));
        return;
      }
      resolve();
    });

    child.on('error', reject);
  });
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    child.kill('SIGTERM');
  }

  setTimeout(() => process.exit(exitCode), 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  await runAndWait('core build', 'npm', ['run', 'build', '--workspace', '@apollo/core']);
  await runAndWait('api build', 'npm', ['run', 'build', '--workspace', '@apollo/api']);

  run('api compiler', 'npm', ['run', 'dev', '--workspace', '@apollo/api']);
  run('api server', 'node', ['--watch', 'packages/api/dist/index.js']);
} catch (error) {
  console.error('[api setup] failed', error);
  shutdown(1);
}
