import { z } from "zod";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const parseBody = <T extends z.ZodType>(schema: T, value: unknown) =>
  schema.parse(value);
