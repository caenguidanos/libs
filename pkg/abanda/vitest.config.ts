/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      globals: false,
      environment: "node",
      coverage: {
         reporter: ["text", "json", "html"],
         lines: 90,
         functions: 90,
         statements: 90,
         branches: 90,
      },
   },
});
