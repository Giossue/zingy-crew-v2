import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Patrón Singleton para evitar agotar el pool en desarrollo
const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: process.env.DB_MAX_CONNECTIONS ? parseInt(process.env.DB_MAX_CONNECTIONS) : 10,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });