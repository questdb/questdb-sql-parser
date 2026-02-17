import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/grammar/index.ts"],
  format: ["esm", "cjs"],
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ["chevrotain"],
  dts: false,
})
