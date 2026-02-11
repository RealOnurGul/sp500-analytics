import path from "path";
import fs from "fs";

/**
 * Resolve the repo data directory so it works whether the app is run from
 * the project root (e.g. data/) or from web/ (e.g. ../data).
 * Use DATA_DIR env for overrides (absolute path).
 */
export function getDataDir(): string {
  const cwd = process.cwd();
  const candidates: string[] = [
    ...(process.env.DATA_DIR ? [process.env.DATA_DIR] : []),
    path.resolve(cwd, "data"),
    path.resolve(cwd, "..", "data"),
  ];
  for (const dir of candidates) {
    const meta = path.join(dir, "meta");
    if (fs.existsSync(meta)) return dir;
  }
  return path.resolve(cwd, "..", "data");
}
