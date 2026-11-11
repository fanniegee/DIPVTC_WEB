const fs = require("node:fs/promises");
const path = require("node:path");

const siteRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(__dirname, "public");
const bundledEngine = ["assets", "DIPvtC-MARK-ENGINE-v4.1.0-local-test-ready"].join("/");

async function main() {
  await fs.mkdir(publicRoot, { recursive: true });
  const excludedRoots = new Set(["server-main", "database", "node_modules", ".git", ".gitignore", ".env", ".env.example", "package.json", "package-lock.json", "server"]);
  const entries = await fs.readdir(siteRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedRoots.has(entry.name) || entry.name === "server.js") continue;
    const source = path.join(siteRoot, entry.name);
    const destination = path.join(publicRoot, entry.name);
    const filter = child => {
      const relative = path.relative(siteRoot, child).split(path.sep).join("/");
      return relative !== bundledEngine && !relative.startsWith(`${bundledEngine}/`);
    };
    await fs.cp(source, destination, { recursive: true, force: true, filter });
  }
  console.log(`Website files copied to ${publicRoot}`);
}

main().catch(error => {
  console.error("Could not prepare the website files:", error.message);
  process.exitCode = 1;
});
