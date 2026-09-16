import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { writeOutputs } from "./plan.mjs";

export function schemaChanged(before, after) {
  const current = JSON.parse(after); // Invalid generated JSON is an error, not a skip.
  try {
    return !isDeepStrictEqual(JSON.parse(before), current);
  } catch {
    return true;
  }
}

export function checkContract(base, cwd = process.cwd()) {
  const paths = ["apps/backend/openapi.json", "packages/api-client/src/generated"];
  let previous = "";
  if (/^[a-f0-9]{40,64}$/.test(base ?? "")) {
    try {
      previous = execFileSync("git", ["show", `${base}:${paths[0]}`], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      /* Missing baseline schema means the frontend must be checked. */
    }
  }
  const changed = schemaChanged(previous, readFileSync(resolve(cwd, paths[0]), "utf8"));
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...paths],
    { cwd, encoding: "utf8" },
  );
  if (dirty)
    throw new Error(
      `Generated API files are stale. Run pnpm generate and commit the results.\n${dirty}`,
    );
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const changed = checkContract(process.env.CI_BASE);
  writeOutputs({ changed });
  console.log(`OpenAPI contract changed: ${changed}`);
}
