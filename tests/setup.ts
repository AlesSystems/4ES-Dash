import '@testing-library/jest-dom/vitest';
import { config } from 'dotenv';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { steamServer } from './mocks/steam-server';

// Load committed placeholder env for tests — no real secrets, no live Steam calls.
config({ path: '.env.test' });

// Intercept all Steam HTTP calls — any unhandled request fails the test in CI.
beforeAll(() => steamServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => steamServer.resetHandlers());
afterAll(() => steamServer.close());
