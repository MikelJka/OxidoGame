/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages publica el juego en https://mikeljka.github.io/OxidoGame/
export default defineConfig({
  base: '/OxidoGame/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Algunos tests generan 20 mapas grandes.
    testTimeout: 30_000,
  },
});
