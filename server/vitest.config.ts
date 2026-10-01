import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        root: '.',
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov'],
            include: ['src/services/**/*.ts', 'src/api/middleware/**/*.ts'],
            exclude: [
                'src/services/index.ts',
                'src/services/_deprecated_*',
                'src/**/*.test.ts',
            ],
        },
        setupFiles: ['./src/__tests__/setup.ts'],
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
