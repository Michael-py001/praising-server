module.exports = {
  apps: [
    {
      name: 'praising-server',
      port: '3000',
      exec_mode: 'cluster',
      instances: 'max',
      script: './dist/main.js',
    },
  ],
};
