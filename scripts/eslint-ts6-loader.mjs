/**
 * Pins ESLint's view of `typescript` to the side-by-side TypeScript 6 install.
 *
 * typescript-eslint 8.x throws at module load when it sees the TypeScript 7 API, so no ESLint
 * config option can work around it — the redirect has to happen in module resolution, before
 * typescript-eslint is ever evaluated. `tsc` and the Next.js build still use TypeScript 7.
 *
 * registerHooks (rather than an ESM loader) is required because eslint-config-next reaches
 * typescript-eslint through CommonJS `require`, which ESM resolve hooks do not intercept.
 *
 * Remove this file, the `lint` script flag, and the typescript-for-eslint dependency once
 * typescript-eslint supports TS >= 7 (typescript-eslint#10940).
 */

import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts6Path = require.resolve("typescript-for-eslint");
const ts6Url = pathToFileURL(ts6Path).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "typescript") {
      return { url: ts6Url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
