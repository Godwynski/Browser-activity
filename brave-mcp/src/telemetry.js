import http from 'http';
import { globalTelemetry } from './telemetry-server.js';

class TelemetryClient {
  constructor(port = 8765) {
    this.port = port;
  }

  startTask(id, name, subject = 'General', totalSteps = 1) {
    globalTelemetry.startTask(id, name, subject, totalSteps);
    console.log(`[TELEMETRY] Task Started: ${name} [${subject}] (Steps: ${totalSteps})`);
  }

  step(currentStep, totalSteps, stepName) {
    globalTelemetry.step(currentStep, totalSteps, stepName);
    console.log(`[TELEMETRY] [${currentStep}/${totalSteps}] ${stepName}`);
  }

  log(text, level = 'info') {
    globalTelemetry.log(text, level);
    console.log(`[TELEMETRY] [${level.toUpperCase()}] ${text}`);
  }

  complete(summary = 'Task completed successfully') {
    globalTelemetry.complete(summary);
    console.log(`[TELEMETRY] Completed: ${summary}`);
  }

  error(errMsg) {
    globalTelemetry.error(errMsg);
    console.error(`[TELEMETRY] Error: ${errMsg}`);
  }
}

export const telemetry = new TelemetryClient();
