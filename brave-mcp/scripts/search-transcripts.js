import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\Godwyn\\.gemini\\antigravity-ide\\brain';
const folders = fs.readdirSync(brainDir);

for (const f of folders) {
  const tPath = path.join(brainDir, f, '.system_generated', 'logs', 'transcript.jsonl');
  if (fs.existsSync(tPath)) {
    try {
      const content = fs.readFileSync(tPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('ITSM') || line.includes('5713245') || (line.includes('midterm') && line.includes('assignment'))) {
          // parse line
          try {
            const data = JSON.parse(line);
            if (data.type === 'USER_INPUT' || (data.content && data.content.includes('assignment'))) {
              console.log(`[${f}] [${data.type}] ${JSON.stringify(data.content || data.tool_calls).slice(0, 200)}`);
            }
          } catch (e) {
            console.log(`[${f}] raw match: ${line.slice(0, 150)}`);
          }
        }
      }
    } catch (e) {}
  }
}
