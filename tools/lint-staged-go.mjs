import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Lefthook runs this from apps/backend after formatting and re-staging.
const diff = spawnSync('git', ['diff', '--cached', '--relative', '--no-ext-diff', '--no-color', '--', '*.go'], {
  encoding: 'utf8',
});
if (diff.error || diff.status !== 0) {
  console.error(diff.error?.message ?? diff.stderr);
  process.exit(1);
}
if (!diff.stdout.trim()) process.exit(0);

const directory = mkdtempSync(join(tmpdir(), 'architect-go-lint-'));
let exitCode = 1;
try {
  const patch = join(directory, 'staged.patch');
  writeFileSync(patch, diff.stdout);
  // Reuse the pinned linter command from the Nx target.
  const project = JSON.parse(readFileSync('project.json', 'utf8'));
  const [command, ...args] = project.targets.lint.options.command.split(' ');
  const result = spawnSync(command, [...args, `--new-from-patch=${patch}`, '--whole-files'], {
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.exit(exitCode);
