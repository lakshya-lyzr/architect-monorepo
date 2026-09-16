import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './apps/backend/openapi.json',
  output: './packages/api-client/src/generated',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    '@tanstack/react-query',
  ],
});
