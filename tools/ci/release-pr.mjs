import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const shaPattern = /^[a-f0-9]{40,64}$/;
const marker = "<!-- architect-release-pr -->";

export function githubApi({
  repository,
  token,
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !token)
    throw new Error("GitHub repository and token are required.");
  return async (method, path, body) => {
    const response = await fetchImpl(`${apiUrl}/repos/${repository}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(
        `GitHub ${method} ${path} failed (${response.status}): ${result.message ?? "unknown error"}`,
      );
      error.status = response.status;
      throw error;
    }
    return result;
  };
}

export async function listPulls(api, filters) {
  const result = [];
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ ...filters, per_page: "100", page: String(page) });
    const items = await api("GET", `/pulls?${query}`);
    if (!Array.isArray(items)) throw new Error("GitHub returned an invalid pull request list.");
    result.push(...items);
    if (items.length < 100) return result;
  }
}

export function gitHistory({ cwd = process.cwd(), token } = {}) {
  const git = (args, env = process.env) =>
    execFileSync("git", args, {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  return {
    refresh() {
      // Supply credentials only to this fetch process, never to disk or argv.
      const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
      if (token)
        Object.assign(env, {
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "http.extraHeader",
          GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
        });
      git(
        [
          "fetch",
          "--no-tags",
          "origin",
          "+refs/heads/dev:refs/remotes/origin/dev",
          "+refs/heads/main:refs/remotes/origin/main",
        ],
        env,
      );
      return {
        dev: git(["rev-parse", "refs/remotes/origin/dev"]),
        main: git(["rev-parse", "refs/remotes/origin/main"]),
      };
    },
    ancestor(commit, tip) {
      if (!shaPattern.test(commit ?? "") || !shaPattern.test(tip ?? "")) return false;
      try {
        git(["merge-base", "--is-ancestor", commit, tip]);
        return true;
      } catch {
        return false;
      }
    },
    releaseHead(pr) {
      if (!shaPattern.test(pr.merge_commit_sha ?? "")) return null;
      const parents = git(["show", "-s", "--format=%P", pr.merge_commit_sha]).split(" ");
      // Merge commits preserve the exact dev snapshot as their second parent.
      // Squash/rebase releases use the merged PR's recorded head instead.
      return parents.length > 1 ? parents[1] : pr.head?.sha;
    },
    unreleased(dev, main, releasedHead) {
      return new Set(
        git(["rev-list", dev, "--not", main, ...(releasedHead ? [releasedHead] : [])])
          .split("\n")
          .filter(Boolean),
      );
    },
    sameTree(dev, main) {
      return git(["rev-parse", `${dev}^{tree}`]) === git(["rev-parse", `${main}^{tree}`]);
    },
  };
}

export function includedPulls({ merged, releases, history, tips, repository }) {
  const completed = releases
    .filter(
      (pr) =>
        pr.merged_at &&
        pr.base?.ref === "main" &&
        pr.head?.ref === "dev" &&
        pr.head?.repo?.full_name === repository &&
        history.ancestor(pr.merge_commit_sha, tips.main),
    )
    .sort((a, b) => b.merged_at.localeCompare(a.merged_at) || b.number - a.number);
  let releasedHead;
  for (const release of completed) {
    const head = history.releaseHead(release);
    if (history.ancestor(head, tips.dev)) {
      releasedHead = head;
      break;
    }
  }
  const commits = history.unreleased(tips.dev, tips.main, releasedHead);
  const unique = new Map();
  for (const pr of merged) {
    if (!pr.merged_at || pr.base?.ref !== "dev" || !commits.has(pr.merge_commit_sha)) continue;
    // A main -> dev synchronization is not a new production change.
    if (pr.head?.ref === "main" && pr.head?.repo?.full_name === repository) continue;
    unique.set(pr.number, pr);
  }
  return [...unique.values()].sort(
    (a, b) => a.merged_at.localeCompare(b.merged_at) || a.number - b.number,
  );
}

function markdown(text) {
  return String(text)
    .replace(/[\r\n\t]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@/g, "&#64;")
    .replace(/[\\`*_[\]]/g, "\\$&");
}

export function releaseDescription(
  prs,
  { now = new Date(), timeZone = "Asia/Kolkata", repository, serverUrl = "https://github.com" },
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type).value;
  const date = `${part("day")} ${part("month")}, ${part("year")}`;
  const title = `Release: dev -> main (${date}, ${prs.length} ${prs.length === 1 ? "PR" : "PRs"})`;
  const lines = prs.map((pr) => {
    const login = pr.user?.login;
    const author = login
      ? `([@${markdown(login)}](${serverUrl}/${encodeURIComponent(login)}))`
      : "(deleted account)";
    return `- [${markdown(pr.title)} #${pr.number}](${serverUrl}/${repository}/pull/${pr.number}) ${author}`;
  });
  const body = [
    marker,
    "Release `dev` → `main`. Merging this promotes these changes to the production branch.",
    "## Merged into dev since the last release",
    lines.length
      ? lines.join("\n")
      : "No merged PRs were found for these changes. This release includes commits made directly to `dev`.",
    "_Updated automatically by `release-pr.yml` after PRs merge into `dev`, after a release merges into `main`, or on a manual run._",
    "_The PR count excludes direct commits and `main` → `dev` synchronization PRs. Deployment is not configured yet._",
  ].join("\n\n");
  if (body.length > 65000)
    throw new Error("Release notes exceed the GitHub PR description limit. Split this release.");
  return { title, body };
}

async function openRelease(api, repository) {
  const owner = repository.split("/")[0];
  const pulls = await listPulls(api, { state: "open", base: "main", head: `${owner}:dev` });
  const matches = pulls.filter(
    (pr) =>
      pr.base?.ref === "main" && pr.head?.ref === "dev" && pr.head?.repo?.full_name === repository,
  );
  if (matches.length > 1)
    throw new Error(
      "Multiple open dev -> main release PRs found. Resolve duplicates before retrying.",
    );
  return matches[0];
}

export async function upsertRelease(api, repository, description) {
  let existing = await openRelease(api, repository);
  if (!existing) {
    try {
      const created = await api("POST", "/pulls", { base: "main", head: "dev", ...description });
      return { action: "created", number: created.number, url: created.html_url };
    } catch (error) {
      if (error.status !== 422) throw error;
      // Someone may have opened the same PR between the lookup and creation.
      existing = await openRelease(api, repository);
      if (!existing) throw error;
    }
  }
  const current = await api("GET", `/pulls/${existing.number}`);
  if (current.state !== "open") return { action: "retry" };
  if (current.title === description.title && current.body === description.body)
    return { action: "unchanged", number: current.number, url: current.html_url };
  const updated = await api("PATCH", `/pulls/${current.number}`, description);
  if (updated.state !== "open") return { action: "retry" };
  return { action: "updated", number: updated.number, url: updated.html_url };
}

export async function maintainRelease({
  api,
  history,
  repository,
  now = new Date(),
  timeZone = "Asia/Kolkata",
  serverUrl = "https://github.com",
  dryRun = false,
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const tips = history.refresh();
    if (history.ancestor(tips.dev, tips.main) || history.sameTree(tips.dev, tips.main))
      return { action: "no-changes" };
    const [merged, releases] = await Promise.all([
      listPulls(api, { state: "closed", base: "dev" }),
      listPulls(api, { state: "closed", base: "main", head: `${repository.split("/")[0]}:dev` }),
    ]);
    const prs = includedPulls({ merged, releases, history, tips, repository });
    const description = releaseDescription(prs, { repository, now, timeZone, serverUrl });
    const refreshed = history.refresh();
    if (tips.dev !== refreshed.dev || tips.main !== refreshed.main) continue;
    if (dryRun) return { action: "preview", ...description };
    const result = await upsertRelease(api, repository, description);
    const final = history.refresh();
    if (result.action !== "retry" && tips.dev === final.dev && tips.main === final.main)
      return { ...result, count: prs.length };
  }
  throw new Error(
    "Branches or release PR changed repeatedly during this run. Re-run Release PR to reconcile the latest state.",
  );
}

async function main() {
  const { GITHUB_REPOSITORY: repository, GITHUB_TOKEN: token } = process.env;
  const result = await maintainRelease({
    api: githubApi({ repository, token, apiUrl: process.env.GITHUB_API_URL }),
    history: gitHistory({ token }),
    repository,
    timeZone: process.env.RELEASE_TIME_ZONE ?? "Asia/Kolkata",
    serverUrl: process.env.GITHUB_SERVER_URL ?? "https://github.com",
    dryRun: process.argv.includes("--dry-run"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Release PR\n\nResult: ${result.action}${result.url ? ` — ${result.url}` : ""}.\n`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
