import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".vercel",
      ".output",
      ".data",
      ".tanstack",
      "node_modules",
      "src/routeTree.gen.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended, prettier],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
);
