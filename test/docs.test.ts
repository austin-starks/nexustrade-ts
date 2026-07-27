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
import * as builders from "../src/generated/ntSdk.generated.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = ["README.md", "AGENTS.md"];
const CLIENT_CALL = /\bclient\.([A-Za-z_][A-Za-z0-9_]*)\(/g;
const PACKAGE_CALL = /\bnt\.([A-Za-z_][A-Za-z0-9_]*)\(/g;

function names(text: string, pattern: RegExp): string[] {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[1]))].sort();
}

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
