/** `.env` fallback contract. Mirrored by tests/test_env.py in the Python SDK. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  dotenvDisabled,
  environmentValue,
  findDotenv,
  loadDotenvValues,
  parseDotenv,
} from "../src/env.ts";

function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const original = { ...process.env };
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  }
}

function tempDir(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), "nt-env-")));
}

describe("parseDotenv", () => {
  it("parses the common shapes", () => {
    const parsed = parseDotenv(
      [
        "# a comment",
        "",
        "PLAIN=value",
        "  SPACED  =  padded  ",
        "export EXPORTED=exported-value",
        "SINGLE='single quoted'",
        'DOUBLE="double quoted"',
        'ESCAPED="line\\nbreak"',
        "EMPTY=",
      ].join("\n"),
    );
    assert.deepEqual(parsed, {
      PLAIN: "value",
      SPACED: "padded",
      EXPORTED: "exported-value",
      SINGLE: "single quoted",
      DOUBLE: "double quoted",
      ESCAPED: "line\nbreak",
      EMPTY: "",
    });
  });

  it("keeps a hash inside an unquoted value", () => {
    // Truncating at an inline `#` would silently corrupt a credential that
    // legitimately contains one. Losing a token beats keeping a comment.
    assert.equal(
      parseDotenv("NEXUSTRADE_API_KEY=sk-abc#def").NEXUSTRADE_API_KEY,
      "sk-abc#def",
    );
  });

  it("lets the first occurrence of a key win", () => {
    assert.deepEqual(parseDotenv("K=first\nK=second"), { K: "first" });
  });

  it("ignores lines without an equals", () => {
    assert.deepEqual(parseDotenv("JUST_A_WORD\n=novalue\nK=v"), { K: "v" });
  });

  it("handles a value containing equals", () => {
    assert.equal(parseDotenv("URL=a=b=c").URL, "a=b=c");
  });

  it("handles CRLF line endings", () => {
    assert.deepEqual(parseDotenv("A=1\r\nB=2"), { A: "1", B: "2" });
  });
});

describe("discovery", () => {
  it("finds a .env in a parent directory", () => {
    const root = tempDir();
    writeFileSync(join(root, ".env"), "NEXUSTRADE_API_KEY=sk-parent\n");
    const nested = join(root, "a", "b", "c");
    mkdirSync(nested, { recursive: true });

    assert.equal(findDotenv(nested), join(root, ".env"));
  });
});

describe("precedence", () => {
  it("lets the real environment beat the file", () => {
    // The rule that matters: a stale file must never override an export.
    withEnv({ NEXUSTRADE_API_KEY: "sk-real" }, () => {
      assert.equal(
        environmentValue("NEXUSTRADE_API_KEY", {
          NEXUSTRADE_API_KEY: "sk-from-file",
        }),
        "sk-real",
      );
    });
  });

  it("uses the file when the variable is absent", () => {
    withEnv({ NEXUSTRADE_API_KEY: undefined }, () => {
      assert.equal(
        environmentValue("NEXUSTRADE_API_KEY", {
          NEXUSTRADE_API_KEY: "sk-from-file",
        }),
        "sk-from-file",
      );
    });
  });

  it("treats blank as absent on both sides", () => {
    withEnv({ NEXUSTRADE_API_KEY: "   " }, () => {
      assert.equal(
        environmentValue("NEXUSTRADE_API_KEY", { NEXUSTRADE_API_KEY: "sk-x" }),
        "sk-x",
      );
      assert.equal(
        environmentValue("NEXUSTRADE_API_KEY", { NEXUSTRADE_API_KEY: " " }),
        undefined,
      );
    });
  });

  it("does not mutate the process environment", () => {
    // Importing an SDK must not change how unrelated code reads its config.
    const root = tempDir();
    writeFileSync(join(root, ".env"), "SOME_UNRELATED_VARIABLE=leaked\n");
    withEnv({ SOME_UNRELATED_VARIABLE: undefined }, () => {
      loadDotenvValues(root);
      assert.equal(process.env.SOME_UNRELATED_VARIABLE, undefined);
    });
  });
});

describe("disable switch", () => {
  it("honours the opt-out", () => {
    const root = tempDir();
    writeFileSync(join(root, ".env"), "NEXUSTRADE_API_KEY=sk-from-file\n");
    for (const value of ["1", "true", "yes", "TRUE"]) {
      withEnv({ NEXUSTRADE_DISABLE_DOTENV: value }, () => {
        assert.equal(dotenvDisabled(), true);
        assert.deepEqual(loadDotenvValues(root), {});
      });
    }
  });

  it("does not disable on falsey values", () => {
    for (const value of ["", "0", "false", "no"]) {
      withEnv({ NEXUSTRADE_DISABLE_DOTENV: value }, () => {
        assert.equal(dotenvDisabled(), false);
      });
    }
  });
});
