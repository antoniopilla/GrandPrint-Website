const net = require("node:net");
const { config, validateConfig } = require("./config.cjs");

function assertSocketTarget(args, allowedPorts) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  if (typeof options === "number" || typeof options === "string") {
    options = { port: Number(options), host: typeof args[1] === "string" ? args[1] : "" };
  }
  if (!options || options.path || options.host !== "127.0.0.1" || !allowedPorts.includes(Number(options.port))) {
    throw new Error("Blocked outbound socket outside the reviewed local demo targets.");
  }
}
function installSocketGuard(allowedPorts = [config.apiPort, 27027]) {
  validateConfig();
  const original = net.Socket.prototype.connect;
  const guarded = function (...args) {
    assertSocketTarget(args, allowedPorts);
    return original.apply(this, args);
  };
  net.Socket.prototype.connect = guarded;
  return () => { if (net.Socket.prototype.connect === guarded) net.Socket.prototype.connect = original; };
}
module.exports = { assertSocketTarget, installSocketGuard };
