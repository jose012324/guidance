import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Root is the renderer source directory
  root: path.resolve(__dirname, 'src/renderer'),

  // Build configuration
  build: {
    // Output to dist/renderer
    outDir: path.resolve(__dirname, 'dist/renderer'),
    // Empty the output directory before building
    emptyOutDir: true,
    // Rollup options
    rollupOptions: {
      // Single entry point
      input: {
        renderer: path.resolve(__dirname, 'src/renderer/renderer.ts'),
      },
      output: {
        // Single bundled file
        entryFileNames: '[name].js',
        // Don't split chunks - keep everything in one file for simplicity
        inlineDynamicImports: true,
      },
    },
    // Target Electron's renderer (Chromium)
    target: 'chrome120',
    // Don't minify for easier debugging
    minify: false,
    // Generate source maps
    sourcemap: true,
  },

  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },

  // Development server (not used in Electron, but good for reference)
  server: {
    port: 5173,
  },
});
