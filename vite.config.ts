import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({}) => {
  return {
    plugins: [react()],
    // base: './', // Removed for Vercel deployment to ensure correct asset loading from root
    server: {
      host: true, // Exposes the server to your local network (0.0.0.0)
      port: 5173, // Ensures the port remains consistent
    }
  };
});