/**
 * The docs teach an API that must actually exist.
 *
 * README.md and AGENTS.md are what a human and a coding agent copy from, so a
 * method named there and missing here is a broken example, not a typo. Both
 * files use one convention: `nt` is the package (builders), `client` is a
 * `NexusTradeClient`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { NexusTradeClient } from "../src/client.ts";
import { PortfolioHandle } from "../src/portfolio.ts";
import * as builders from "../src/generated/ntSdk.generated.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = ["README.md", "AGENTS.md"];
const CLIENT_CALL = /\bclient\.([A-Za-z_][A-Za-z0-9_]*)\(/g;
const PACKAGE_CALL = /\bnt\.([A-Za-z_][A-Za-z0-9_]*)\(/g;

function names(text: string, pattern: RegExp): string[] {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[1]))].sort();
}

/** Every symbol either doc mentions — called, or named in a method table. */
function documentedNames(): Set<string> {
  const found = new Set<string>();
  for (const doc of DOCS) {
    const text = readFileSync(join(ROOT, doc), "utf8");
    for (const m of text.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]{2,})\(/g)) found.add(m[1]);
    for (const m of text.matchAll(/`([a-zA-Z_][a-zA-Z0-9_]{2,})`/g)) found.add(m[1]);
  }
  return found;
}

/**
 * `private` is erased at runtime, so the prototype still carries private
 * methods. Read the modifier from the source, the way checkSdkClientParity
 * does, rather than treating every prototype key as public API.
 */
function privateNames(sourceFile: string): Set<string> {
  const source = readFileSync(join(ROOT, "src", sourceFile), "utf8");
  return new Set(
    [...source.matchAll(/^\s*private\s+(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map(
      (match) => match[1],
    ),
  );
}

function publicMethods(proto: object, sourceFile: string): string[] {
  const nonPublic = privateNames(sourceFile);
  return Object.getOwnPropertyNames(proto).filter(
    (name) =>
      name !== "constructor" &&
      !name.startsWith("#") &&
      !nonPublic.has(name) &&
      typeof (proto as Record<string, unknown>)[name] === "function",
  );
}

/**
 * Nothing public may be absent from the docs.
 *
 * The 1.0.0 docs omitted 11 of 36 client methods, including the whole portfolio
 * lifecycle. None of it was a decision — sections got written and the rest
 * drifted. A table fixes it once; this keeps it fixed.
 */
describe("documentation completeness", () => {
  it("documents every public NexusTradeClient method", () => {
    const documented = documentedNames();
    const missing = publicMethods(NexusTradeClient.prototype, "client.ts")
      .filter((name) => !documented.has(name))
      .sort();
    assert.deepEqual(
      missing,
      [],
      `${missing.length} public NexusTradeClient method(s) appear in neither ` +
        `README.md nor AGENTS.md: ${missing.join(", ")}. Add them to the method table.`,
    );
  });

  it("documents every public PortfolioHandle method", () => {
    const documented = documentedNames();
    const missing = publicMethods(PortfolioHandle.prototype, "portfolio.ts")
      .filter((name) => !documented.has(name) && name !== "toJSON")
      .sort();
    assert.deepEqual(
      missing,
      [],
      `${missing.length} public PortfolioHandle method(s) are undocumented: ` +
        missing.join(", "),
    );
  });

  it("keeps CLAUDE.md pointing at the complete reference", () => {
    // CLAUDE.md stays a pointer on purpose: duplicating AGENTS.md into it would
    // create exactly the drift the pointer exists to prevent.
    assert.match(readFileSync(join(ROOT, "CLAUDE.md"), "utf8"), /AGENTS\.md/);
  });
});

describe("documented symbols", () => {
  const clientProto = NexusTradeClient.prototype as unknown as object;

  for (const doc of DOCS) {
    const text = readFileSync(join(ROOT, doc), "utf8");

    it(`${doc} only calls client methods that exist`, () => {
      for (const name of names(text, CLIENT_CALL)) {
        assert.ok(
          name in clientProto,
          `${doc} calls client.${name}(), which does not exist`,
        );
      }
    });

    it(`${doc} only calls builders the package exports`, () => {
      for (const name of names(text, PACKAGE_CALL)) {
        assert.ok(
          name in builders,
          `${doc} calls nt.${name}(), which the package does not export`,
        );
      }
    });

    it(`${doc} does not reach client methods through the package`, () => {
      for (const name of names(text, PACKAGE_CALL)) {
        assert.ok(
          !(name in clientProto && !(name in builders)),
          `${doc} calls nt.${name}(), but ${name} is a client method — ` +
            `write client.${name}() instead`,
        );
      }
    });
  }
});
