import { defineConfig } from "vitest/config";

/**
 * Test API dijalankan serial dan sengaja kecil (≤40 request per run) supaya
 * server dev tidak kebanjiran. Tidak ada load/stress test di repo ini.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Satu file pada satu waktu, satu worker: beban server minimal.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { shuffle: false },
    reporters: ["default"],
  },
});
