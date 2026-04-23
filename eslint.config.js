import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      /* 強制 const / === */
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      /* 限制巢狀層級 */
      "max-depth": ["warn", 3],
      /* 限制函式參數 */
      "max-params": ["warn", 3],
      /* 禁止 console（生產環境） */
      "no-console": "warn",
    },
  },
);
