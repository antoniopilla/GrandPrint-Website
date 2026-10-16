const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "../..");
const config = Object.freeze({
  root,
  host: "127.0.0.1",
  apiPort: 5212,
  clientPort: 3212,
  apiOrigin: "http://127.0.0.1:5212",
  clientOrigin: "http://127.0.0.1:3212",
  mongoUri: "mongodb://127.0.0.1:27027/grandprint_portfolio_demo?directConnection=true",
  database: "grandprint_portfolio_demo",
  stateDir: path.join(root, ".portfolio-demo"),
  adminPassword: "portfolio-demo-only",
  marker: "grandprint-portfolio-local-v1",
});

function validateConfig(value = config) {
  const expected = config;
  for (const key of ["host", "apiPort", "clientPort", "apiOrigin", "clientOrigin", "mongoUri", "database", "stateDir"]) {
    if (value[key] !== expected[key]) throw new Error(`Refusing a changed local demo target: ${key}`);
  }
  for (const origin of [value.apiOrigin, value.clientOrigin]) {
    const url = new URL(origin);
    if (url.hostname !== "127.0.0.1" || url.protocol !== "http:" || url.username || url.password || url.search || url.hash) {
      throw new Error("The screenshot demo accepts fixed loopback origins only.");
    }
  }
  return value;
}

function requireOptIn(argv = process.argv, env = process.env) {
  validateConfig();
  if (!argv.includes("--confirm-local") || env.GRANDPRINT_PORTFOLIO_DEMO !== "1") {
    throw new Error("Use the portfolio-demo launcher with --confirm-local after local targets are reviewed.");
  }
}

function systemEnv() {
  const safe = {};
  for (const key of ["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME"]) {
    if (process.env[key]) safe[key] = process.env[key];
  }
  return safe;
}

function stateDirectory() {
  validateConfig();
  if (fs.existsSync(config.stateDir)) {
    if (fs.lstatSync(config.stateDir).isSymbolicLink()) throw new Error("Refusing linked demo storage.");
    const markerFile = path.join(config.stateDir, "ownership.json");
    if (fs.existsSync(markerFile)) assertOrdinaryEntry(markerFile, "file");
    if (!fs.existsSync(markerFile) || JSON.parse(fs.readFileSync(markerFile, "utf8")).marker !== config.marker) {
      throw new Error("Existing demo storage has no matching ownership marker; nothing was changed.");
    }
  } else {
    fs.mkdirSync(config.stateDir);
    fs.writeFileSync(path.join(config.stateDir, "ownership.json"), JSON.stringify({ marker: config.marker }), { flag: "wx" });
  }
  return config.stateDir;
}

function assertOrdinaryEntry(file, kind, io = fs) {
  const stat = io.lstatSync(file);
  if (stat.isSymbolicLink() || (kind === "directory" ? !stat.isDirectory() : !stat.isFile())) throw new Error("Refusing a linked or unexpected demo storage entry.");
  if (path.resolve(io.realpathSync(file)).toLowerCase() !== path.resolve(file).toLowerCase()) throw new Error("Refusing redirected demo storage.");
}
function ownedSubdirectory(name) {
  if (!["assets", "mail"].includes(name)) throw new Error("Unknown demo storage directory.");
  const directory = path.join(stateDirectory(), name);
  if (fs.existsSync(directory)) assertOrdinaryEntry(directory, "directory");
  else fs.mkdirSync(directory);
  return directory;
}

module.exports = { config, validateConfig, requireOptIn, systemEnv, stateDirectory, assertOrdinaryEntry, ownedSubdirectory };
