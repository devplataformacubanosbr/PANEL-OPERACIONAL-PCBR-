import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import JavaScriptObfuscator from 'javascript-obfuscator'

function antiReplicationObfuscator() {
  return {
    name: 'vite-plugin-anti-replication-obfuscator',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (chunk.fileName.endsWith('.js')) {
        try {
          const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.6,
            deadCodeInjection: false,
            debugProtection: false,
            disableConsoleOutput: true,
            identifierNamesGenerator: 'hexadecimal',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            rotateStringArray: true,
            selfDefending: true,
            splitStrings: true,
            splitStringsChunkLength: 8,
            stringArray: true,
            stringArrayEncoding: ['base64', 'rc4'],
            stringArrayThreshold: 0.75,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
          });
          return {
            code: obfuscated.getObfuscatedCode(),
            map: null
          };
        } catch (err) {
          console.warn('[Obfuscator] Skip chunk ' + chunk.fileName + ':', err.message);
          return null;
        }
      }
      return null;
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), antiReplicationObfuscator()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
    },
  },
})

