import { telemetry } from '../../src/telemetry.js';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log("⚡ Starting Telemetry Live Demonstration...");

  telemetry.startTask('demo-cgp-lab1', 'Solve Lab 1: Wireframe Cube', 'Computer Graphics Programming', 4);
  await sleep(1000);

  telemetry.step(1, 4, 'Analyzing Handout & 3D Vertices');
  telemetry.log('Parsed 8 vertices from 03_Laboratory_Exercise_1.pdf', 'info');
  telemetry.log('Edge topology: 12 wireframe edges verified', 'info');
  await sleep(1500);

  telemetry.step(2, 4, 'Building Python OpenGL Script');
  telemetry.log('Generated courses/Computer_Graphics_Programming/assignments/midterm/03_Laboratory_Exercise_1/src/wireframe_cube.py', 'step');
  telemetry.log('Implemented perspective projection and glRotatef loop', 'info');
  await sleep(1500);

  telemetry.step(3, 4, 'Running Validation Tests');
  telemetry.log('OpenGL context initialized at 800x600', 'info');
  telemetry.log('Rendering 60 FPS rotation check passed', 'success');
  await sleep(1500);

  telemetry.step(4, 4, 'Formatting Deliverable');
  telemetry.log('Compiled final report into answer.md', 'step');
  telemetry.log('Cleaned up scratch text files from .tmp/', 'info');
  await sleep(1000);

  telemetry.complete('03 Laboratory Exercise 1: Wireframe Cube completed successfully!');
  console.log("🎉 Telemetry demonstration completed!");
}

runDemo().catch(console.error);
