/**
 * Minimal `.env` support, zero dependencies.
 *
 * The SDK reads process environment variables. That is the correct primary
 * source — but it surprises people, because writing credentials into a `.env`
 * file is the near-universal local convention, and a client that ignores one
 * fails with "requires an API key" while the key is sitting right there on disk.
 *
 * So the client falls back to a `.env` file. Deliberately narrow:
 *
 * - **The real environment always wins.** A `.env` value is used only when the
 *   variable is absent from `process.env`. A stale file must never silently
 *   override what you exported.
 * - **Nothing is mutated.** `process.env` is left alone, so importing this SDK
 *   cannot change how unrelated code in the same process reads its own config.
 * - **Only NexusTrade's own variables are consumed.** The file is parsed in
 *   full, but the client asks for `NEXUSTRADE_*` and nothing else.
 *
 * Kept byte-for-byte equivalent to `env.py` in the Python SDK; the parser rules
 * below are the shared contract.
 *
 * Node 20.6+ ships `process.loadEnvFile()`, but it mutates `process.env` and
 * this package supports Node 18 — so the walk and parse live here.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// A pathological symlink loop or a very deep tree should not turn credential
// resolution into an unbounded walk.
const MAX_PARENTS = 32;

const DISABLE_VARIABLE = "NEXUSTRADE_DISABLE_DOTENV";

const ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  "\\": "\\",
  '"': '"',
};

/** True when the caller opted out through the real environment. */
export function dotenvDisabled(): boolean {
  const value = (process.env[DISABLE_VARIABLE] ?? "").trim().toLowerCase();
  return value !== "" && value !== "0" && value !== "false" && value !== "no";
}

function unescape(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "\\" && index + 1 < value.length) {
      const replacement = ESCAPES[value[index + 1]];
      if (replacement !== undefined) {
        out += replacement;
        index += 1;
        continue;
      }
    }
    out += character;
  }
  return out;
}

/**
 * Parse `.env` text.
 *
 * Rules, shared with the Python SDK:
 *
 * - blank lines and lines whose first non-space character is `#` are skipped
 * - an optional leading `export` is ignored
 * - everything before the first `=` is the key; the rest is the value
 * - a value wrapped in matching single or double quotes is unquoted;
 *   double-quoted values also resolve `\n`, `\r`, `\t`, `\\`, `\"`
 * - an unquoted value is taken literally to end of line, after trimming.
 *   Inline `#` comments are NOT stripped — a token may legitimately contain
 *   `#`, and silently truncating a credential is worse than keeping a trailing
 *   comment nobody writes.
 * - the FIRST occurrence of a key wins, matching the "never override" stance
 */
export function parseDotenv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trimStart();
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key || Object.prototype.hasOwnProperty.call(values, key)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      value[0] === value[value.length - 1] &&
      (value[0] === "'" || value[0] === '"')
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = unescape(value);
    }
    values[key] = value;
  }
  return values;
}

/** First `.env` at or above `start` (default: the current directory). */
export function findDotenv(start?: string): string | null {
  let current: string;
  try {
    current = resolve(start ?? process.cwd());
  } catch {
    return null;
  }
  for (let depth = 0; depth < MAX_PARENTS; depth += 1) {
    const candidate = join(current, ".env");
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      return null;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** Values from the nearest `.env`. Never throws; unreadable means empty. */
export function loadDotenvValues(start?: string): Record<string, string> {
  if (dotenvDisabled()) return {};
  const path = findDotenv(start);
  if (path === null) return {};
  try {
    return parseDotenv(readFileSync(path, "utf8"));
  } catch {
    // A malformed or unreadable file must not break a client that was going to
    // be handed an explicit key anyway.
    return {};
  }
}

/**
 * Reads the `.env` at most once, and only if something actually needs it.
 *
 * The file walk is skipped entirely when the environment already answers —
 * which is always the case inside `run_compute`, where the platform injects the
 * variables. Constructing a client should not stat up to 32 directories to
 * discover a file it was never going to consult.
 */
export class LazyDotenv {
  #values: Record<string, string> | null = null;
  readonly #start?: string;

  constructor(start?: string) {
    this.#start = start;
  }

  get(name: string): string | undefined {
    if (this.#values === null) this.#values = loadDotenvValues(this.#start);
    return this.#values[name];
  }

  /** True once the file has actually been read. Used by tests. */
  get loaded(): boolean {
    return this.#values !== null;
  }
}

/** `process.env` first, then `.env`. Blank is treated as absent. */
export function environmentValue(
  name: string,
  dotenv?: LazyDotenv | Record<string, string>,
): string | undefined {
  const live = process.env[name];
  if (live && live.trim()) return live;
  const source = dotenv ?? new LazyDotenv();
  const fallback =
    source instanceof LazyDotenv ? source.get(name) : source[name];
  return fallback && fallback.trim() ? fallback : undefined;
}
