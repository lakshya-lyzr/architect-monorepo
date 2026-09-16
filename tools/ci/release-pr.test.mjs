import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  githubApi,
  gitHistory,
  includedPulls,
  listPulls,
  maintainRelease,
  releaseDescription,
  upsertRelease,
} from "./release-pr.mjs";

const repository = "example/project";
const now = new Date("2026-09-12T10:00:00Z");
const pr = (number, extra = {}) => ({
  number,
  title: `Change ${number}`,
  merged_at: `2026-09-${String(number).padStart(2, "0")}T00:00:00Z`,
  base: { ref: "dev" },
  head: { ref: `feature-${number}`, repo: { full_name: repository } },
  merge_commit_sha: `commit-${number}`,
  user: { login: "author" },
  ...extra,
});
const release = {
  number: 20,
  state: "open",
  base: { ref: "main" },
  head: { ref: "dev", repo: { full_name: repository } },
};
const description = releaseDescription([pr(1)], { repository, now });

test("title uses full month, India date, and PR count; body links titles and authors", () => {
  const result = releaseDescription([pr(1), pr(2), pr(3), pr(4)], { repository, now });
  assert.equal(result.title, "Release: dev -> main (12 September, 2026, 4 PRs)");
  assert.match(
    result.body,
    /\[Change 1 #1\]\(https:\/\/github.com\/example\/project\/pull\/1\) \(\[@author\]/,
  );
  assert.match(description.title, /1 PR\)/);
  assert.match(
    releaseDescription([], { repository, now: new Date("2026-09-12T20:00:00Z") }).title,
    /13 September, 2026, 0 PRs/,
  );
});

test("untrusted titles stay text and deleted authors work", () => {
  const result = releaseDescription(
    [pr(1, { title: "[click](bad) <img> @all\nnew", user: null })],
    { repository, now },
  );
  assert.ok(result.body.includes("\\[click\\](bad) &lt;img&gt; &#64;all new"));
  assert.match(result.body, /deleted account/);
});

test("pull request lists paginate and fail on invalid responses", async () => {
  const pages = [];
  const result = await listPulls(
    async (_, path) => {
      pages.push(path);
      return pages.length === 1 ? Array.from({ length: 100 }, (_, i) => pr(i)) : [pr(101)];
    },
    { state: "closed" },
  );
  assert.equal(result.length, 101);
  assert.match(pages[1], /page=2/);
  await assert.rejects(
    listPulls(async () => ({}), {}),
    /invalid pull request list/,
  );
});

test("GitHub errors propagate without being treated as empty history", async () => {
  const api = githubApi({
    repository,
    token: "test",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: "Denied" }) }),
  });
  await assert.rejects(api("GET", "/pulls"), /403.*Denied/);
});

for (const method of ["merge", "squash", "rebase"]) {
  test(`${method} release excludes already released PRs using real Git ancestry`, () => {
    const cwd = mkdtempSync(join(tmpdir(), "release-pr-"));
    const git = (...args) =>
      execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Test",
          GIT_AUTHOR_EMAIL: "test@example.com",
          GIT_COMMITTER_NAME: "Test",
          GIT_COMMITTER_EMAIL: "test@example.com",
        },
      }).trim();
    try {
      git("init", "--quiet");
      const tree = git("mktree");
      const commit = (message, parents = []) =>
        git("commit-tree", tree, ...parents.flatMap((p) => ["-p", p]), "-m", message);
      const base = commit("base");
      const first = commit("first feature", [base]);
      const main = commit(`${method} release`, method === "merge" ? [base, first] : [base]);
      const next = commit("next feature", [first]);
      const history = gitHistory({ cwd });
      const released = pr(10, {
        base: { ref: "main" },
        head: { ...release.head, sha: first },
        merge_commit_sha: main,
      });
      const merged = [pr(1, { merge_commit_sha: first }), pr(2, { merge_commit_sha: next })];
      assert.deepEqual(
        includedPulls({
          merged,
          releases: [released],
          history,
          tips: { dev: next, main },
          repository,
        }).map((p) => p.number),
        [2],
      );
      assert.equal(history.releaseHead(released), first);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test("counts distinct merged dev PRs, excluding syncs and unrelated history", () => {
  const merged = [
    pr(1),
    pr(1),
    pr(2, { merged_at: null }),
    pr(3, { base: { ref: "other" } }),
    pr(4, { head: { ref: "main", repo: { full_name: repository } } }),
    pr(5),
  ];
  const history = { unreleased: () => new Set(merged.slice(0, -1).map((p) => p.merge_commit_sha)) };
  assert.deepEqual(
    includedPulls({ merged, releases: [], history, tips: {}, repository }).map((p) => p.number),
    [1],
  );
});

test("creates an absent release PR", async () => {
  const calls = [];
  const result = await upsertRelease(
    async (method, path, body) => {
      calls.push({ method, path, body });
      return method === "GET" ? [] : { number: 20 };
    },
    repository,
    description,
  );
  assert.equal(result.action, "created");
  assert.deepEqual(calls[1].body, { base: "main", head: "dev", ...description });
});

for (const unchanged of [false, true]) {
  test(`existing release is ${unchanged ? "unchanged" : "updated"}`, async () => {
    const writes = [];
    const result = await upsertRelease(
      async (method, path, body) => {
        if (path.startsWith("/pulls?")) return [release];
        if (method === "PATCH") {
          writes.push(body);
          return release;
        }
        return { ...release, ...(unchanged ? description : {}) };
      },
      repository,
      description,
    );
    assert.equal(result.action, unchanged ? "unchanged" : "updated");
    assert.equal(writes.length, unchanged ? 0 : 1);
  });
}

test("creation race updates the release that another run created", async () => {
  let lists = 0;
  const result = await upsertRelease(
    async (method, path) => {
      if (path.startsWith("/pulls?")) return ++lists === 1 ? [] : [release];
      if (method === "POST") throw Object.assign(new Error("Already exists"), { status: 422 });
      return release;
    },
    repository,
    description,
  );
  assert.equal(result.action, "updated");
});

test("closed release causes a retry; duplicate releases fail explicitly", async () => {
  assert.equal(
    (
      await upsertRelease(
        async (_, path) =>
          path.startsWith("/pulls?") ? [release] : { ...release, state: "closed" },
        repository,
        description,
      )
    ).action,
    "retry",
  );
  await assert.rejects(
    upsertRelease(async () => [release, release], repository, description),
    /Multiple open/,
  );
});

const fakeHistory = () => ({
  refresh: () => ({ dev: "dev-tip", main: "main-tip" }),
  ancestor: () => false,
  sameTree: () => false,
  unreleased: () => new Set(["commit-1"]),
});

test("no differences needs no API requests", async () => {
  const history = { ...fakeHistory(), sameTree: () => true };
  assert.deepEqual(
    await maintainRelease({
      history,
      repository,
      api: () => assert.fail("Unexpected API request"),
    }),
    { action: "no-changes" },
  );
});

test("dry run generates notes without writing", async () => {
  const result = await maintainRelease({
    history: fakeHistory(),
    repository,
    now,
    dryRun: true,
    api: async (method, path) => {
      assert.equal(method, "GET");
      return path.includes("base=dev") ? [pr(1)] : [];
    },
  });
  assert.equal(result.action, "preview");
  assert.equal(result.title, description.title);
});

test("moving branch tips retry and never publish stale notes", async () => {
  let refreshes = 0;
  const history = {
    ...fakeHistory(),
    refresh: () => ({ dev: `tip-${++refreshes}`, main: "main-tip" }),
  };
  await assert.rejects(
    maintainRelease({
      history,
      repository,
      api: async (method) => {
        assert.equal(method, "GET");
        return [];
      },
    }),
    /changed repeatedly/,
  );
  assert.equal(refreshes, 6);
});
