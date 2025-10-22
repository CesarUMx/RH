module.exports = {
  apps: [
    {
      name: 'rh-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 4173',
      cwd: '/home/admon/RH/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
