import { spawnSync } from 'node:child_process';

const check = process.argv.includes('--check');
const result = spawnSync('gofmt', [check ? '-l' : '-w', '.'], {
  encoding: 'utf8',
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.stderr) process.stderr.write(result.stderr);
if (result.stdout) process.stdout.write(result.stdout);
if (result.status !== 0) process.exit(result.status ?? 1);
if (check && result.stdout.trim()) {
  console.error('Run pnpm format to format these Go files.');
  process.exit(1);
}
