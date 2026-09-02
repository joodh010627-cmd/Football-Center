import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * The first test that touches the import engine pays for Vite pre-bundling
 * ExcelJS — around 30s on a cold cache, then effectively free. That is a build
 * cost, not a slow test, so the timeout is generous rather than the suite being
 * restructured around it.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  }),
);
