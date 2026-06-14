import '@testing-library/jest-dom/vitest';
import { config } from 'dotenv';

// Load committed placeholder env for tests — no real secrets, no live Steam calls.
config({ path: '.env.test' });
