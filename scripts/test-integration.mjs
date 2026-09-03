import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".env", quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST deve existir e ser diferente de DATABASE_URL.");
}

const childEnvironment = { ...process.env, DATABASE_URL: testDatabaseUrl };

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const command = isWindows ? process.env.ComSpec ?? "cmd.exe" : "npm";
    const commandArgs = isWindows ? ["/d", "/s", "/c", "npm", ...args] : args;
    const child = spawn(command, commandArgs, {
      env: childEnvironment,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comando npm falhou com codigo ${code}.`));
      }
    });
  });
}

await runNpm(["exec", "--", "prisma", "migrate", "deploy"]);
await runNpm(["exec", "--", "vitest", "run", "--config", "vitest.integration.config.mts"]);
