#!/usr/bin/env node
/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".grok/app-env.json");
const extra = {};
if (existsSync(envPath)) {
  try {
    Object.assign(extra, JSON.parse(readFileSync(envPath, "utf8")));
  } catch {}
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: with-app-env.mjs <command> [...args]");
  process.exit(1);
}

const [cmd, ...cmdArgs] = args;
const child = spawn(cmd, cmdArgs, {
  stdio: "inherit",
  env: { ...process.env, ...Object.fromEntries(
    Object.entries(extra).filter(([k]) => typeof extra[k] === "string").map(([k,v]) => [k, String(v)])
  )},
  shell: false,
});
child.on("exit", (code) => process.exit(code ?? 1));
