import { execSync } from 'child_process';

try {
  const stdout = execSync('powershell "Get-Process brave -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -Unique"', { encoding: 'utf8' });
  console.log('Brave paths:', stdout.trim());
} catch (e) {
  console.error(e);
}
