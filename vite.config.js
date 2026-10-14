import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Builds the browser extension into dist, one unpacked folder that
 * Chrome, Edge, Firefox and Safari's converter all load. APP_URL decides which
 * server it talks to: `APP_URL=https://remember-this.io npm run build:extension`.
 */
export default defineConfig(({ mode }) => {
    const appUrl = new URL(loadEnv(mode, process.cwd(), '').APP_URL ?? 'http://localhost:8000');
    // Match patterns may not carry a port; without one they match every port.
    const sitePattern = `${appUrl.protocol}//${appUrl.hostname}/*`;

    return {
        root: resolve('.'),
        base: './',
        publicDir: resolve('public'),
        define: { __APP_URL__: JSON.stringify(appUrl.origin) },
        plugins: [
            tailwindcss(),
            {
                name: 'remember-this-extension-manifest',
                generateBundle() {
                    const manifest = readFileSync(resolve('manifest.json'), 'utf8').replaceAll('__SITE_PATTERN__', sitePattern);

                    this.emitFile({ type: 'asset', fileName: 'manifest.json', source: manifest });
                },
            },
        ],
        build: {
            outDir: resolve('dist'),
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    popup: resolve('popup.html'),
                    callback: resolve('callback.html'),
                    background: resolve('src/background.js'),
                    region: resolve('src/region.js'),
                },
                output: {
                    // The manifest and scripting.executeScript name these two, so no hash.
                    entryFileNames: (chunk) => (['background', 'region'].includes(chunk.name) ? '[name].js' : 'assets/[name]-[hash].js'),
                },
            },
        },
    };
});
