import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({}) => {
  return {
    plugins: [react(), tailwindcss()],
    // base: './', // Removed for Vercel deployment to ensure correct asset loading from root
    server: {
      host: true, // Exposes the server to your local network (0.0.0.0)
      port: 3000, // Ensures the port remains consistent with platform requirements
    }
  };
});