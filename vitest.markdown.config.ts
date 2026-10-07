import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    maxWorkers: 1,
    include: [
      "tests/markdown-rendering.test.tsx",
      "tests/issue-list-rendering.test.tsx",
    ],
  },
});
