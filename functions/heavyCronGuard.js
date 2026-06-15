let running = false;
let runningJob = null;

export function isHeavyCronRunning() {
  return running;
}

export function getHeavyCronJob() {
  return runningJob;
}

export async function runHeavyCron(jobName, fn) {
  running = true;
  runningJob = jobName;
  try {
    return await fn();
  } finally {
    running = false;
    runningJob = null;
  }
}
