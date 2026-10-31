/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// O site é servido em https://joaovmoura.github.io/nfe-reader-app/,
// então todos os caminhos gerados precisam desse prefixo.
const base = '/nfe-reader-app/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Gera os ícones PNG do PWA a partir de public/favicon.svg durante o build.
      pwaAssets: {
        image: 'public/favicon.svg',
        overrideManifestIcons: true,
      },
      manifest: {
        name: 'NFe Reader — preços de mercado',
        short_name: 'NFe Reader',
        description: 'Leia cupons fiscais e acompanhe os preços do mercado.',
        lang: 'pt-BR',
        theme_color: '#1b7f4b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
