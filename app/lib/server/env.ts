import { readFileSync } from "node:fs";
import path from "node:path";

// The app shares the repository's root .env with Foundry and the CRE CLI.
export const repoRoot = path.resolve(process.cwd(), "..");

const parse = (file: string): Record<string, string> => {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const i = line.indexOf("=");
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
};

const rootEnv = parse(path.join(repoRoot, ".env"));

export const env = (name: string): string | undefined => process.env[name] ?? rootEnv[name];
