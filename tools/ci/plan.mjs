import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const full = (reason) => ({ backend: true, frontend: true, contract: true, reason });
const shaPattern = /^[a-f0-9]{40,64}$/;

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function isAncestor(base, cwd) {
  if (!shaPattern.test(base ?? "")) return false;
  try {
    git(["merge-base", "--is-ancestor", base, "HEAD"], cwd);
    return true;
  } catch {
    return false;
  }
}

export function classify(files) {
  const result = { backend: false, frontend: false, contract: false, reason: "changed paths" };
  for (const file of files) {
    // Only known documentation paths are exempt. Unknown paths fail safe.
    if (
      file.startsWith("docs/") ||
      /^(README\.md|LICENSE(?:\.md)?|AGENTS\.md|CLAUDE\.md)$/.test(file) ||
      /^apps\/(web|backend)\/(README|AGENTS|CLAUDE)\.md$/.test(file)
    )
      continue;
    if (file.startsWith("apps/web/")) {
      result.frontend = true;
    } else if (file === "apps/backend/openapi.json") {
      result.contract = true;
    } else if (file.startsWith("apps/backend/")) {
      result.backend = true;
      if (!file.endsWith("_test.go") && file !== "apps/backend/.golangci.yml")
        result.contract = true;
    } else if (file.startsWith("packages/api-client/") || file === "openapi-ts.config.ts") {
      result.frontend = true;
      result.contract = true;
    } else if (file === "tools/gofmt.mjs" || file === "tools/lint-staged-go.mjs") {
      result.backend = true;
    } else {
      return full("shared tooling, configuration, or an unclassified path changed");
    }
  }
  return result;
}

export async function comparisonBase({ eventName, event, env, cwd, fetchImpl = fetch }) {
  if (eventName === "pull_request") {
    const base = event.pull_request?.base?.sha;
    return isAncestor(base, cwd) ? base : null;
  }
  if (eventName !== "push" || event.forced || !env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY)
    return null;
  const branch = (event.ref ?? "").replace(/^refs\/heads\//, "");
  if (!branch) return null;
  try {
    // A push's `before` SHA may never have passed CI (cancelled/failed runs).
    // Only a successful run on this same branch establishes a safe baseline.
    for (let page = 1; page <= 3; page++) {
      const url = new URL(
        `${env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs`,
      );
      url.search = new URLSearchParams({
        branch,
        event: "push",
        status: "success",
        per_page: "100",
        page: String(page),
      });
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return null;
      const { workflow_runs: runs } = await response.json();
      if (!Array.isArray(runs)) return null;
      for (const run of runs) {
        if (
          run.conclusion === "success" &&
          run.event === "push" &&
          run.head_branch === branch &&
          isAncestor(run.head_sha, cwd)
        ) {
          return run.head_sha;
        }
      }
      if (runs.length < 100) return null;
    }
  } catch {
    // API outages, rate limits, and missing history must not skip checks.
  }
  return null;
}

export function planFromBase(base, cwd = process.cwd()) {
  if (!isAncestor(base, cwd))
    return { ...full("no reliable baseline; checking everything"), base: "" };
  try {
    // --no-renames includes both old and new paths; -z preserves unusual filenames.
    const files = git(["diff", "--name-only", "--no-renames", "-z", base, "HEAD", "--"], cwd)
      .split("\0")
      .filter(Boolean);
    return { ...classify(files), base, changedFiles: files.length };
  } catch {
    return { ...full("could not compare revisions; checking everything"), base: "" };
  }
}

export function writeOutputs(values, outputFile = process.env.GITHUB_OUTPUT) {
  if (outputFile)
    appendFileSync(
      outputFile,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const base = await comparisonBase({
    eventName: process.env.GITHUB_EVENT_NAME,
    event,
    env: process.env,
    cwd: process.cwd(),
  });
  const plan = planFromBase(base);
  writeOutputs({
    backend: plan.backend,
    frontend: plan.frontend,
    contract: plan.contract,
    base: plan.base,
  });
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Selected checks\n\n${plan.reason}.\n\n- Backend: ${plan.backend}\n- Frontend source/config: ${plan.frontend}\n- Compare generated contract: ${plan.contract}\n\nA changed contract also selects frontend checks.\n`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
