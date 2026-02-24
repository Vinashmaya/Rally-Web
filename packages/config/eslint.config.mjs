import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";

/**
 * Rally ESLint Flat Config
 *
 * Shared across all apps and packages. No `any`. No `@ts-ignore`.
 * No uncontrolled `eslint-disable`. Prefer const. Unused vars
 * with _ prefix are allowed (convention for intentional omission).
 */
const config = [
  // ── Base JS recommended rules ───────────────────────────────
  js.configs.recommended,

  // ── Global ignores ──────────────────────────────────────────
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
    ],
  },

  // ── TypeScript files ────────────────────────────────────────
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      import: importPlugin,
    },
    rules: {
      // ── TypeScript strictness ─────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": "allow-with-description",
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ── General quality ───────────────────────────────────
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      curly: ["error", "multi-line"],

      // ── React ─────────────────────────────────────────────
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "warn",
      "react/self-closing-comp": "warn",
      "react/jsx-no-target-blank": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── Imports ───────────────────────────────────────────
      "import/no-duplicates": "warn",
      "import/first": "warn",
      "import/newline-after-import": "warn",
      "import/no-default-export": "off", // Next.js pages require default exports

      // ── Disable base rules that conflict with TS ──────────
      "no-unused-vars": "off",
      "no-undef": "off", // TypeScript handles this
      "no-redeclare": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // ── Next.js specific rules ──────────────────────────────────
  {
    files: ["**/apps/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // ── Config files (JS/MJS — looser rules) ────────────────────
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
];

export default config;
