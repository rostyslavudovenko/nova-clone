#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;

// tauri.conf.json
const tauriConfPath = "src-tauri/tauri.conf.json";
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`\u2713 tauri.conf.json \u2192 ${version}`);

// Cargo.toml
const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8");
const updated = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
writeFileSync(cargoPath, updated);
console.log(`\u2713 Cargo.toml \u2192 ${version}`);

// Cargo.lock
const lockPath = "src-tauri/Cargo.lock";
const lock = readFileSync(lockPath, "utf8");
const updatedLock = lock.replace(/(name\s*=\s*"nova-clone"\s*\nversion\s*=\s*")[^"]+(")/, `$1${version}$2`);
writeFileSync(lockPath, updatedLock);
console.log(`\u2713 Cargo.lock  \u2192 ${version}`);

// HTML files (sidebar footer)
const htmlFiles = ["index.html", "settings.html", "history.html"];
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const updatedHtml = html.replace(
    /(Licensed under the MIT License<\/a> &middot; )v[\d.]+/,
    `$1v${version}`
  );
  writeFileSync(file, updatedHtml);
  console.log(`\u2713 ${file} \u2192 v${version}`);
}

// Stage files
execSync("git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock " + htmlFiles.join(" "));

console.log(`\nAll versions synced to ${version}`);
