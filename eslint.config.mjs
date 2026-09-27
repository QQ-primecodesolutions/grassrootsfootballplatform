import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  // Multi-tenancy guard: tenant data is only touched through lib/db/queries, which
  // require an organisation scope. App code must not import the schema or client.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/db/**", "scripts/**", "tests/**", "drizzle.config.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/schema", "@/lib/db/client", "**/db/schema", "**/db/client"],
              message: "Use the org-scoped helpers in @/lib/db/queries instead (see CLAUDE.md, multi-tenancy).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "db/migrations/**", ".kilo/**"]),
]);

export default eslintConfig;
