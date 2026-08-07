/**
 * PM2 process definition for the Hostinger VPS.
 *
 * Runs the Next.js standalone server directly. `.next/standalone/server.js`
 * bundles its own traced node_modules, so PM2 needs no package manager at
 * runtime — which is also why the deploy script has to copy `public/` and
 * `.next/static` in beside it (Next does not include them in standalone).
 *
 * CommonJS on purpose: package.json has no "type": "module", and PM2 reads
 * this file with require().
 */
module.exports = {
  apps: [
    {
      name: "gstpilot",
      cwd: "/var/www/gstpilot/current",
      script: ".next/standalone/server.js",

      // fork, not cluster. The standalone server is already a plain HTTP
      // server; running N cluster workers on a small VPS mostly multiplies
      // memory for no throughput gain, and Prisma opens a pool per process.
      // Scale by raising instances only after measuring.
      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // Bind to loopback only. Nginx is the sole public entry point; binding
        // 0.0.0.0 would expose the app on :3000 straight past the TLS layer.
        HOSTNAME: "127.0.0.1",
      },

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: "20s",
      // A GSTR-1 run holds a workbook in memory. 700M is comfortable headroom
      // on a 2 GB box; raise it if you process very large multi-platform runs.
      max_memory_restart: "700M",

      // Logs. PM2 rotates these only if pm2-logrotate is installed — the guide
      // installs it.
      output: "/var/log/gstpilot/out.log",
      error: "/var/log/gstpilot/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
