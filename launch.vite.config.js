import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('./launch',import.meta.url)),
  envDir:false,
  publicDir:'public',
  base:'./',
  build:{outDir:'../dist-launch',emptyOutDir:true,sourcemap:false},
  server:{host:'127.0.0.1'},
});
