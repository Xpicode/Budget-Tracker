import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/setup.js',   // create + migrate + empty the test database, once
    setupFiles: ['./test/env.js'],    // every worker talks to the test database
    fileParallelism: false,           // test files share one database; run them one at a time
  },
});
