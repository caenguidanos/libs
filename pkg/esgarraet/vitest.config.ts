/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      globals: false,
      environment: "node",
      coverage: {
         reporter: ["text", "json", "html"],
         lines: 100,
         functions: 100,
         statements: 100,
         branches: 100,
      },
   },
});
