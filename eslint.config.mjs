import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/**
 * eslint-plugin-react 7.37.5 (a transitive dependency of eslint-config-next) still uses the
 * ESLint 9 rule context API and crashes on ESLint 10. Its rules are dropped here; the Next.js,
 * react-hooks, import, jsx-a11y and typescript-eslint rule sets all survive. Remove this filter
 * once eslint-plugin-react ships ESLint 10 support.
 */
function withoutReactPlugin(entries) {
  return entries.map((entry) => {
    if (!entry.plugins?.react) return entry;
    const { react: _react, ...plugins } = entry.plugins;
    const rules = Object.fromEntries(
      Object.entries(entry.rules ?? {}).filter(([rule]) => !rule.startsWith("react/"))
    );
    return { ...entry, plugins, rules };
  });
}

const config = [
  ...withoutReactPlugin(nextCoreWebVitals),
  ...withoutReactPlugin(nextTypescript),
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "./../*"],
              message: "Use path aliases (@/...) instead of relative parent imports.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "Never access process.env directly. Use @/lib/env instead.",
        },
      ],
    },
  },
  {
    files: [
      "src/lib/env.ts",
      "src/lib/env/**",
      "next.config.ts",
      "*.config.{ts,mjs}",
      "playwright.config.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
];

export default config;
