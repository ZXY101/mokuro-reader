import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true
  },
  optimizeDeps: {
    exclude: ['clsx', 'tailwind-merge', 'apexcharts', '@floating-ui/dom']
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress sourcemap warnings from node_modules (e.g., Flowbite Svelte)
        if (warning.code === 'SOURCEMAP_ERROR' && warning.message.includes('node_modules')) {
          return;
        }
        // Suppress annotation warnings from node_modules
        if (warning.code === 'INVALID_ANNOTATION' && warning.loc?.file?.includes('node_modules')) {
          return;
        }
        warn(warning);
      }
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,svelte}'],
    globals: true,
    environment: 'jsdom'
  }
});
