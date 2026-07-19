import { neon } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set. Add it to your .env file.');
}

// Neon's HTTP driver — one round-trip per query, perfect for serverless.
// Use as a tagged template: await sql`select ...`. Values are parameterized.
export const sql = neon(env.DATABASE_URL);
