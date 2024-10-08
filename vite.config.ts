import { defineConfig, } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from "vite-plugin-svgr";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';
import { VitePWA } from 'vite-plugin-pwa';

let base = process.env.PUBLIC_URL ?? '/';
if(!base.endsWith("/")) base += '/';

console.log(`Building for base = ${base}`);

// https://vitejs.dev/config/
export default ({ mode }) => {
  return defineConfig({
    base,
    plugins: [
      svgr(),
      react(),
      nodePolyfills({
        globals: {
          Buffer: false,
        },
        exclude: ['buffer'],
      }),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null, // manual registration
        manifestFilename: 'manifest.js',
        workbox: {
          maximumFileSizeToCacheInBytes: 1024 * 1024 * 10, // 10 MiB
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
                },
              },
            },
          ],
        },
      }),
    ],
    build: {
      commonjsOptions: { transformMixedEsModules: true },
      rollupOptions: {
        plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],
      },
    }
  })
}
