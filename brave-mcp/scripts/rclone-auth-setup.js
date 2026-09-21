import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const rcloneExe = 'C:\\Users\\Godwyn\\AppData\\Local\\Microsoft\\WinGet\\Links\\rclone.exe';
const yeFolderId = '1-EVXvTHoixX6dREzBz0VfKpLoX3Q_AFn';

console.log('🚀 Starting rclone authorize "drive"...');

const child = spawn(rcloneExe, ['authorize', 'drive'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let tokenFound = false;

child.stdout.on('data', (data) => {
  const str = data.toString();
  output += str;
  process.stdout.write(str);

  // Check for token JSON
  const match = str.match(/\{"access_token":.*?\}/s) || output.match(/\{"access_token":.*?\}/s);
  if (match && !tokenFound) {
    tokenFound = true;
    const tokenStr = match[0].trim();
    console.log('\n\n🔑 Successfully captured OAuth token!');

    // Create rclone.conf
    const confDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'rclone');
    if (!fs.existsSync(confDir)) {
      fs.mkdirSync(confDir, { recursive: true });
    }

    const confPath = path.join(confDir, 'rclone.conf');
    const confContent = `[gdrive]
type = drive
scope = drive
token = ${tokenStr}
root_folder_id = ${yeFolderId}
`;

    fs.writeFileSync(confPath, confContent, 'utf8');
    console.log(`✅ Saved rclone configuration to: ${confPath}`);
    console.log(`📁 Root folder locked to 'ye': ${yeFolderId}`);

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  if (!tokenFound) {
    console.log(`rclone process exited with code ${code}`);
    process.exit(code);
  }
});
