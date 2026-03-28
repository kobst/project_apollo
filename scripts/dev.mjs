import { spawn } from 'node:child_process';

const children = new Set();

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
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

run('api', 'node', ['scripts/dev-api.mjs']);
run('ui', 'npm', ['run', 'dev', '--workspace', '@apollo/ui']);
