import js from "@eslint/js"
import tseslint from "typescript-eslint"
import prettier from "eslint-plugin-prettier"
import prettierConfig from "eslint-config-prettier"
import globals from "globals"
import { Linter } from "eslint"

export default [
  {
    ignores: ["dist/", "node_modules/", "eslint.config.ts", "tsup.config.ts", "src/parser/cst-types.d.ts"],
  },
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
      ecmaVersion: 2020,
      sourceType: "module",
    },
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": "warn",
    },
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.reduce(
        (acc, config) => ({ ...acc, ...config.rules }),
        {} as Linter.RulesRecord,
      ),
      ...tseslint.configs.recommendedTypeChecked.reduce(
        (acc, config) => ({ ...acc, ...config.rules }),
        {} as Linter.RulesRecord,
      ),

      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          caughtErrors: "none",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],

      "quote-props": ["error", "as-needed"],
      "object-shorthand": ["error", "always"],
      "no-unused-vars": "off",
      "no-var": ["error"],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],
      // NaN is used as a Chevrotain token name (SQL NaN keyword)
      "no-shadow-restricted-names": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },

  prettierConfig,
] satisfies Linter.Config[]
