import { readFile } from "node:fs/promises";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { type DocumentType, type Ruleset, rulesetSchema } from "./schema";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { ruleset: Ruleset; fetchedAt: number };
const cache = new Map<DocumentType, CacheEntry>();

function githubConfig() {
  const owner = process.env.RULESET_GITHUB_OWNER;
  const repo = process.env.RULESET_GITHUB_REPO;
  if (!owner || !repo) return null;
  return {
    owner,
    repo,
    ref: process.env.RULESET_GITHUB_REF ?? "main",
    dir: process.env.RULESET_GITHUB_PATH ?? "rules",
    token: process.env.RULESET_GITHUB_TOKEN,
  };
}

async function fetchFromGithub(documentType: DocumentType): Promise<string> {
  const config = githubConfig();
  if (!config) throw new Error("GitHub ruleset source not configured");

  const filename = `${documentType.toLowerCase()}.yaml`;
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dir}/${filename}?ref=${config.ref}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GitHub ruleset fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function readFromLocalDisk(documentType: DocumentType): Promise<string> {
  const filename = `${documentType.toLowerCase()}.yaml`;
  const filePath = path.join(process.cwd(), "rules", filename);
  return readFile(filePath, "utf-8");
}

async function loadRulesetText(documentType: DocumentType): Promise<string> {
  const config = githubConfig();
  if (!config) {
    return readFromLocalDisk(documentType);
  }
  return fetchFromGithub(documentType);
}

/**
 * Returns the active ruleset for a document type, or null if none exists
 * (e.g. "other", or a type not yet drafted such as NDA/MSA).
 * Falls back to the last successfully cached ruleset on fetch failure
 * rather than throwing, per the ruleset delivery mechanism in
 * contract-validator-requirements.md section 3.
 */
export async function getRuleset(documentType: DocumentType): Promise<Ruleset | null> {
  if (documentType === "other") return null;

  const cached = cache.get(documentType);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.ruleset;
  }

  try {
    const text = await loadRulesetText(documentType);
    const parsed = parseYaml(text);
    const ruleset = rulesetSchema.parse(parsed);
    cache.set(documentType, { ruleset, fetchedAt: Date.now() });
    return ruleset;
  } catch (err) {
    if (cached) {
      console.error(
        `Ruleset refresh failed for ${documentType}, serving stale cached ruleset`,
        err,
      );
      return cached.ruleset;
    }
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export function clearRulesetCache(): void {
  cache.clear();
}
