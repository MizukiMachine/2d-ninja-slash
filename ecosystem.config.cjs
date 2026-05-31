const isColyseusCloud = process.env.COLYSEUS_CLOUD !== undefined;
const defaultInstances = 1;
const configuredInstances = Number(process.env.PM2_INSTANCES ?? defaultInstances);
const instances =
  Number.isInteger(configuredInstances) && configuredInstances > 0
    ? configuredInstances
    : defaultInstances;

module.exports = {
  apps: [
    {
      name: '2d-ninja-slash-colyseus',
      script: 'build/index.js',
      time: true,
      watch: false,
      instances,
      exec_mode: 'fork',
      wait_ready: isColyseusCloud,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
