import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    name: "next-rules-disabled",
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    name: "custom/rules",
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
    },
  },
  {
    name: "custom/ignores",
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "__tests__/**",
      "*.test.ts",
      "*.test.tsx",
      "*.spec.ts",
      "*.spec.tsx",
      "bot/**",
      "mcp-server/**",
      "node_modules/**",
    ],
  }
);