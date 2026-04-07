import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['three', '@sparkjsdev/spark'],
  treeshake: true,
  minify: false,
  splitting: false,
  loader: { '.wgsl': 'text' },
})
