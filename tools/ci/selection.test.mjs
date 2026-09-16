import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { classify, comparisonBase, planFromBase, writeOutputs } from "./plan.mjs";
import { schemaChanged, checkContract } from "./contract.mjs";

// All Git history below is synthetic fixture data in a temporary repository.
function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "architect-ci-test-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q", "-b", "dev");
  git("config", "user.name", "CI Fixture");
  git("config", "user.email", "fixture@example.invalid");
  const write = (name, data) => {
    mkdirSync(dirname(join(cwd, name)), { recursive: true });
    writeFileSync(join(cwd, name), data);
  };
  let parent;
  const snapshot = () => {
    git("add", ".");
    const tree = git("write-tree");
    const commit = git(
      "commit-tree",
      tree,
      ...(parent ? ["-p", parent] : []),
      "-m",
      "fixture snapshot",
    );
    git("update-ref", "refs/heads/dev", commit);
    parent = commit;
    return commit;
  };
  return { cwd, git, write, snapshot };
}

for (const [name, files, expected] of [
  ["backend implementation", ["apps/backend/internal/api/api.go"], [true, false, true]],
  ["Go tests only", ["apps/backend/internal/api/api_test.go"], [true, false, false]],
  ["Go lint config", ["apps/backend/.golangci.yml"], [true, false, false]],
  ["Go formatter helper", ["tools/gofmt.mjs"], [true, false, false]],
  ["Go dependencies", ["apps/backend/go.sum"], [true, false, true]],
  ["frontend source", ["apps/web/app/page.tsx"], [false, true, false]],
  ["frontend config", ["apps/web/next.config.ts"], [false, true, false]],
  [
    "generated client edits",
    ["packages/api-client/src/generated/types.gen.ts"],
    [false, true, true],
  ],
  ["generator config", ["openapi-ts.config.ts"], [false, true, true]],
  ["schema edit", ["apps/backend/openapi.json"], [false, false, true]],
  ["docs only", ["README.md", "docs/common/README.md"], [false, false, false]],
  ["MDX application content", ["apps/web/app/content.mdx"], [false, true, false]],
  ["empty diff", [], [false, false, false]],
  ["lockfile", ["pnpm-lock.yaml"], [true, true, true]],
  ["CI policy", ["tools/ci/plan.mjs"], [true, true, true]],
  ["workflow", [".github/workflows/ci.yml"], [true, true, true]],
  ["unknown shared file", ["new-shared-config.json"], [true, true, true]],
]) {
  test(name, () => {
    const result = classify(files);
    assert.deepEqual([result.backend, result.frontend, result.contract], expected);
  });
}

test("backend implementation with unchanged schema skips frontend; contract changes select it", () => {
  const plan = classify(["apps/backend/internal/api/api.go"]);
  const before = '{"properties":{"message":{"type":"string"}},"type":"object"}';
  const reordered = '{"type":"object","properties":{"message":{"type":"string"}}}';
  assert.equal(plan.frontend || schemaChanged(before, reordered), false);
  assert.equal(
    plan.frontend || schemaChanged(before, '{"properties":{"text":{"type":"string"}}}'),
    true,
  );
  assert.equal(schemaChanged("", before), true);
  assert.equal(schemaChanged("bad baseline", before), true);
  assert.throws(() => schemaChanged(before, "invalid generated JSON"));
});

test("renames and deletions include old paths, including spaces and newlines", (t) => {
  const repo = repository(t);
  const source = "apps/web/app/old name\nwith newline.ts";
  repo.write(source, "export const x = 1;");
  repo.write("apps/backend/internal/deleted.go", "package internal");
  const base = repo.snapshot();
  repo.write("docs/placeholder.md", "# Docs");
  renameSync(join(repo.cwd, source), join(repo.cwd, "docs/moved.md"));
  rmSync(join(repo.cwd, "apps/backend/internal/deleted.go"));
  repo.snapshot();
  const plan = planFromBase(base, repo.cwd);
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, true);
  assert.equal(plan.contract, true);
});

test("PR detection includes all commits relative to the target base", async (t) => {
  const repo = repository(t);
  repo.write("README.md", "base");
  const base = repo.snapshot();
  repo.write("apps/web/app/page.tsx", "frontend");
  repo.snapshot();
  repo.write("apps/backend/main.go", "backend");
  repo.snapshot();
  const resolved = await comparisonBase({
    eventName: "pull_request",
    event: { pull_request: { base: { sha: base } } },
    env: {},
    cwd: repo.cwd,
  });
  const plan = planFromBase(resolved, repo.cwd);
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, true);
});

test("push compares with last successful run, covering changes from intervening failed or cancelled runs", async (t) => {
  const repo = repository(t);
  repo.write("README.md", "base");
  const base = repo.snapshot();
  repo.write("apps/web/app/page.tsx", "frontend");
  const failed = repo.snapshot();
  repo.write("apps/backend/main.go", "backend");
  repo.snapshot();
  const env = { GITHUB_TOKEN: "fixture", GITHUB_REPOSITORY: "owner/repo" };
  const resolved = await comparisonBase({
    eventName: "push",
    event: { ref: "refs/heads/dev", before: failed },
    env,
    cwd: repo.cwd,
    fetchImpl: async (url) => {
      assert.equal(url.searchParams.get("status"), "success");
      assert.equal(url.searchParams.get("branch"), "dev");
      return {
        ok: true,
        json: async () => ({
          workflow_runs: [
            { head_sha: failed, head_branch: "dev", conclusion: "failure", event: "push" },
            { head_sha: failed, head_branch: "main", conclusion: "success", event: "push" },
            { head_sha: base, head_branch: "dev", conclusion: "success", event: "push" },
          ],
        }),
      };
    },
  });
  assert.equal(resolved, base);
  assert.equal(planFromBase(resolved, repo.cwd).frontend, true);
});

test("manual runs, force pushes, missing history and API failures check everything", async (t) => {
  const repo = repository(t);
  repo.write("README.md", "base");
  repo.snapshot();
  for (const input of [
    { eventName: "workflow_dispatch", event: {} },
    { eventName: "push", event: { ref: "refs/heads/dev", forced: true } },
    { eventName: "pull_request", event: { pull_request: { base: { sha: "0".repeat(40) } } } },
    { eventName: "push", event: { ref: "refs/heads/dev" }, fetchImpl: async () => ({ ok: false }) },
    {
      eventName: "push",
      event: { ref: "refs/heads/dev" },
      fetchImpl: async () => {
        throw new Error("network down");
      },
    },
    {
      eventName: "push",
      event: { ref: "refs/heads/dev" },
      fetchImpl: async () => ({ ok: true, json: async () => ({ workflow_runs: [] }) }),
    },
  ]) {
    const base = await comparisonBase({
      ...input,
      env: { GITHUB_TOKEN: "fixture", GITHUB_REPOSITORY: "owner/repo" },
      cwd: repo.cwd,
    });
    const result = planFromBase(base, repo.cwd);
    assert.deepEqual([result.backend, result.frontend, result.contract], [true, true, true]);
  }
});

test("contract check catches modified, deleted, and newly generated untracked files", (t) => {
  const repo = repository(t);
  const schema = "apps/backend/openapi.json";
  const client = "packages/api-client/src/generated/types.gen.ts";
  repo.write(schema, '{"openapi":"3.1.0"}');
  repo.write(client, "export type X = string;");
  const base = repo.snapshot();
  assert.equal(checkContract(base, repo.cwd), false);
  repo.write(client, "changed");
  assert.throws(() => checkContract(base, repo.cwd), /stale/);
  repo.write(client, "export type X = string;");
  const extra = "packages/api-client/src/generated/new.gen.ts";
  repo.write(extra, "export type Y = string;");
  assert.throws(() => checkContract(base, repo.cwd), /stale/);
  rmSync(join(repo.cwd, extra));
  rmSync(join(repo.cwd, client));
  assert.throws(() => checkContract(base, repo.cwd), /stale/);
});

test("GitHub outputs use the booleans consumed by workflow conditions", (t) => {
  const repo = repository(t);
  const output = join(repo.cwd, "output");
  writeOutputs({ backend: true, frontend: false, contract: true, base: "" }, output);
  assert.equal(
    readFileSync(output, "utf8"),
    "backend=true\nfrontend=false\ncontract=true\nbase=\n",
  );
});

test("successful-run lookup paginates and ignores commits outside current history", async (t) => {
  const repo = repository(t);
  repo.write("README.md", "base");
  const base = repo.snapshot();
  const calls = [];
  const resolved = await comparisonBase({
    eventName: "push",
    event: { ref: "refs/heads/dev" },
    env: { GITHUB_TOKEN: "fixture", GITHUB_REPOSITORY: "owner/repo" },
    cwd: repo.cwd,
    fetchImpl: async (url) => {
      const page = url.searchParams.get("page");
      calls.push(page);
      const run = { conclusion: "success", event: "push", head_branch: "dev" };
      return {
        ok: true,
        json: async () => ({
          workflow_runs:
            page === "1"
              ? Array.from({ length: 100 }, () => ({ ...run, head_sha: "f".repeat(40) }))
              : [{ ...run, head_sha: base }],
        }),
      };
    },
  });
  assert.equal(resolved, base);
  assert.deepEqual(calls, ["1", "2"]);
});

test("a committed contract change selects frontend even without frontend file changes", (t) => {
  const repo = repository(t);
  const schema = "apps/backend/openapi.json";
  repo.write(schema, '{"properties":{"message":{"type":"string"}}}');
  const base = repo.snapshot();
  repo.write(schema, '{"properties":{"text":{"type":"string"}}}');
  repo.snapshot();
  const plan = planFromBase(base, repo.cwd);
  assert.equal(plan.frontend, false);
  assert.equal(plan.contract, true);
  assert.equal(checkContract(base, repo.cwd), true);
});
