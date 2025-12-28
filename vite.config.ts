import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({}) => {
  return {
    plugins: [react()],
    base: './', // Allows the app to run from a local file path (file://) after building
    server: {
      host: true, // Exposes the server to your local network (0.0.0.0)
      port: 5173, // Ensures the port remains consistent
    }
  };
});