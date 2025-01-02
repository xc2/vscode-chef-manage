import { type LibConfig, defineConfig } from "@rslib/core";

const common = {
  source: {
    entry: {
      main: ["src/**/*.ts", "!**/__*__/**", "!**/*.test.*"],
    },
  },
  output: {
    distPath: { root: "out" },
    externals: ["vscode"],
  },
  bundle: false,
  dts: false,
} satisfies LibConfig;

export default defineConfig({
  lib: [
    {
      ...common,
      format: "cjs",
      syntax: "es2022",
    },
  ],
});
