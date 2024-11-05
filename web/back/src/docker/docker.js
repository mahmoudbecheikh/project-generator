import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function isDockerRunning() {
  try {
    await execAsync('docker info');
    console.log('Docker is running');
    return true;
  } catch (error) {
    console.log('Docker is not running:', error.message);
    return false;
  }
}

async function startDocker() {
  try {
    console.log('Starting Docker...');
    await execAsync('sudo systemctl start docker');
    console.log('Docker started');
    return true;
  } catch (error) {
    console.error('Failed to start Docker:', error.message);
    return false;
  }
}

async function runDockerCompose() {
  const composeFile = path.resolve(process.cwd(), 'docker-compose.yml');

  if (!fs.existsSync(composeFile)) {
    console.error('docker-compose.yml file not found');
    return;
  }

  try {
    const { stdout } = await execAsync('docker-compose up -d');
    console.log('docker-compose running successfully');
    console.log(stdout);
  } catch (error) {
    console.error('Failed to run docker-compose:', error.message);
  }
}

export default async function ensureDockerRunningAndCompose() {
  const isRunning = await isDockerRunning();

  if (!isRunning) {
    const started = await startDocker();
    if (started) {
      await runDockerCompose();
    }
  } else {
    await runDockerCompose();
  }
}
