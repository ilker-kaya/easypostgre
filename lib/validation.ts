import { z } from "zod";

export const postgresConnectionSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().default(5432),
  user: z.string().min(1),
  database: z.string().min(1),
});
