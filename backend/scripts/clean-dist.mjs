import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
await rm(outputDirectory, { recursive: true, force: true });
