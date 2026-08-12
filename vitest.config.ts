import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest picks this file over vite.config.ts, so the plugin list is repeated
// here to keep JSX working if component tests are added later.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    // The 401 tests exercise the real session-teardown path, which ends in
    // window.location.reload(). jsdom cannot navigate and dumps a stack trace
    // for it. The behaviour under test is asserted on storage and the thrown
    // error, so the trace is pure noise.
    onConsoleLog(log) {
      if (log.includes('Not implemented: navigation')) return false;
    },
  },
})
