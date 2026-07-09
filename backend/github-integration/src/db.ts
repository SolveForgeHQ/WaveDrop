import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new pg.Pool({
  connectionString,
  max:                     5,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 15_000,   // allow Neon up to 15s to wake from suspension
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
