// Science of Gifts Local Content Editor Launcher
// Allows running: node server.js
import { spawn } from 'child_process';

const child = spawn('npx', ['tsx', 'server.ts'], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
