import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

// Lazily initialized so importing this module (e.g. during Next.js build-time
// route analysis) never throws just because DATABASE_URL isn't set in that
// environment — the error only surfaces when a query actually runs.
let instance: Db | null = null;

function getDb(): Db {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  instance = drizzle(neon(connectionString), { schema });
  return instance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
