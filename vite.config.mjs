import {defineConfig} from 'vite';
export default defineConfig({define:{'import.meta.env.VITE_STATIC_DEMO':JSON.stringify('true'),'import.meta.env.VITE_MAP_BASE_URL':JSON.stringify('')},build:{outDir:'demo',emptyOutDir:true}});
