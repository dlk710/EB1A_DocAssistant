import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const containerName = "eb1a-qdrant";
const projectRoot = process.cwd();
const storageRoot = path.join(projectRoot, "storage", "qdrant");

fs.mkdirSync(storageRoot, { recursive: true });

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

try {
  run("docker", ["info"]);
} catch {
  console.error(
    "Docker is not running. Start Docker or Colima before launching the EB1A Evidence Studio.",
  );
  process.exit(1);
}

const existing = run("docker", [
  "ps",
  "-a",
  "--filter",
  `name=^/${containerName}$`,
  "--format",
  "{{.State}}",
]);

if (!existing) {
  run("docker", [
    "run",
    "-d",
    "--name",
    containerName,
    "-p",
    "6333:6333",
    "-p",
    "6334:6334",
    "-v",
    `${storageRoot}:/qdrant/storage`,
    "qdrant/qdrant",
  ]);
  console.log(`Started ${containerName}.`);
  process.exit(0);
}

if (existing !== "running") {
  run("docker", ["start", containerName]);
  console.log(`Started ${containerName}.`);
}
