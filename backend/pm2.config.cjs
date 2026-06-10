module.exports = {
  apps: [
    {
      name: "elan-crm-backend",
      script: "./dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      restart_delay: 5000,        // wait 5s before restarting after a crash
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
      },
      // Logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
    },
  ],
};
