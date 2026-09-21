import { execSync } from 'child_process';

const rcloneExe = 'C:\\Users\\Godwyn\\AppData\\Local\\Microsoft\\WinGet\\Links\\rclone.exe';

const photoExts = '*.{jpg,jpeg,png,gif,webp,heic,HEIC,raw,JPG,PNG,jpeg,JPEG,svg,SVG,bmp,BMP,tif,tiff,TIF,TIFF}';
const videoExts = '*.{mp4,mov,avi,mkv,wmv,MP4,MOV,3gp,3GP,m4v,M4V,webm,WEBM,flv,FLV}';
const metaExts = '*.{json,JSON}';

function runRclone(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

async function organizeFolder(folderPath) {
  console.log(`\n========================================`);
  console.log(`📂 Processing: ${folderPath}`);
  console.log(`========================================`);

  // 1. Photos
  console.log('--- Moving Photos ---');
  runRclone(`"${rcloneExe}" move "${folderPath}" "gdrive:Photos" --include "${photoExts}" --drive-server-side-across-configs --transfers 16 --fast-list -v`);

  // 2. Videos
  console.log('--- Moving Videos ---');
  runRclone(`"${rcloneExe}" move "${folderPath}" "gdrive:Videos" --include "${videoExts}" --drive-server-side-across-configs --transfers 16 --fast-list -v`);

  // 3. Metadata
  console.log('--- Moving Metadata ---');
  runRclone(`"${rcloneExe}" move "${folderPath}" "gdrive:Metadata" --include "${metaExts}" --drive-server-side-across-configs --transfers 16 --fast-list -v`);

  // 4. Try removing folder if empty
  try {
    runRclone(`"${rcloneExe}" rmdir "${folderPath}" -q`);
    console.log(`🗑️ Removed empty folder: ${folderPath}`);
  } catch (e) {
    // Might not be empty if there are other file types
  }
}

async function main() {
  // Move remaining root metadata
  try {
    runRclone(`"${rcloneExe}" moveto "gdrive:Shawn Mendez.jpg.supplemental-metadata.json" "gdrive:Metadata/Shawn Mendez.jpg.supplemental-metadata.json" --drive-server-side-across-configs -q`);
  } catch (e) {}

  // Test on Photos from 2022
  await organizeFolder('gdrive:backup/takeout-20260429T145633Z-4-001/Takeout/Google Photos/Photos from 2022');

  console.log('\n🎉 Finished processing Photos from 2022!');
}

main().catch(console.error);
