// Minimal Node require hook so verification scripts can load the project's real
// TypeScript sources (with the "@/…" path alias) using Next.js' bundled SWC.
// Usage: node -r ./scripts/register-ts.js scripts/some-test.js
const path = require("path");
const fs = require("fs");
const Module = require("module");
const { transformSync } = require("next/dist/build/swc");

const SRC_ROOT = path.join(__dirname, "..", "src");
const EXTS = [".ts", ".tsx"];

function compile(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { code } = transformSync(source, {
    filename,
    jsc: {
      parser: { syntax: "typescript", tsx: filename.endsWith(".tsx") },
      target: "es2020",
      transform: { react: { runtime: "automatic" } },
    },
    module: { type: "commonjs" },
    sourceMaps: false,
  });
  module._compile(code, filename);
}

for (const ext of EXTS) {
  require.extensions[ext] = compile;
}

// Resolve "@/foo" -> "<repo>/src/foo"
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.join(SRC_ROOT, request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
