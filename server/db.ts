/**
 * The single Prisma client for the whole app.
 *
 * Next.js dev re-imports modules on every hot reload; without the globalThis
 * guard each reload would leak a new PrismaClient (and its connection pool).
 * In production every serverless instance gets exactly one client.
 *
 * This is the ONLY place `new PrismaClient()` is called — every repository and
 * job imports `{ prisma }` from here. (docs/DATA_MODEL.md, docs/BACKEND.md.)
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
