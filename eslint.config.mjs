import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Regla de capas: el dominio es TypeScript puro, sin I/O ni frameworks.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/adapters/*",
                "@/application/*",
                "@/app/*",
                "@/components/*",
                "@/config/*",
                "@/generated/*",
              ],
              message: "domain/ no puede depender de capas externas.",
            },
            { group: ["node:*", "fs", "path", "http", "https"], message: "domain/ no hace I/O." },
            {
              group: ["@prisma/*", "next", "next/*", "react", "react-dom"],
              message: "domain/ no depende de frameworks.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "next", "next/*", "react"],
              message: "application/ no depende de la UI.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
