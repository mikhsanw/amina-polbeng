module.exports = {
  apps: [
    {
      name: 'amina-api',
      script: './apps/api/dist/main.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        API_PORT: 4000,
      },
    },
    {
      name: 'amina-web',
      script: './apps/web/.next/standalone/apps/web/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
