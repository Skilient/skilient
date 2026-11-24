// Lint for the backend workspace (services/, packages/, tools/, jobs/). apps/web has its own config.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { plugin as skilient, serviceNames } from "./tools/lint/src/index.mjs";

const root = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  { ignores: ["apps/**", "**/gen/**", "**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  ...tseslint.configs.recommended,
  {
    plugins: { skilient },
    rules: {
      "skilient/no-foreign-schema": ["error", { services: serviceNames(root) }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // The rule's own tests name schemas on purpose.
    files: ["tools/lint/test/**"],
    rules: { "skilient/no-foreign-schema": "off" },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
);
