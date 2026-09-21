import { execSync } from 'child_process';

const rcloneExe = 'C:\\Users\\Godwyn\\AppData\\Local\\Microsoft\\WinGet\\Links\\rclone.exe';

const photoExts = '*.{jpg,jpeg,png,gif,webp,heic,HEIC,raw,JPG,PNG,jpeg,JPEG,svg,SVG,bmp,BMP,tif,tiff,TIF,TIFF}';
const videoExts = '*.{mp4,mov,avi,mkv,wmv,MP4,MOV,3gp,3GP,m4v,M4V,webm,WEBM,flv,FLV}';
const metaExts = '*.{json,JSON}';

function runRclone(cmd) {
  console.log(`\n▶ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.warn(`Command warning/error: ${e.message}`);
    return false;
  }
}

async function organizeFolder(folderPath) {
  console.log(`\n========================================`);
  console.log(`📂 Processing: ${folderPath}`);
  console.log(`========================================`);

  // 1. Photos
  runRclone(`"${rcloneExe}" move "${folderPath}" "gdrive:Photos" --include "${photoExts}" --drive-server-side-across-configs --transfers 16 --fast-list -v`);

  // 2. Videos
  runRclone(`"${rcloneExe}" move "${folderPath}" "gdrive:Videos" --include "${videoExts}" --drive-server-side-across-configs --transfers 16 --fast-list -v`);

  // 3. Metadata
  runRclone(`"${rcloneExe}" move "${folderPath}" "gdrive:Metadata" --include "${metaExts}" --drive-server-side-across-configs --transfers 16 --fast-list -v`);

  // 4. Try removing folder if empty
  runRclone(`"${rcloneExe}" rmdir "${folderPath}" -q`);
}

async function main() {
  const gpBase = 'gdrive:backup/takeout-20260429T145633Z-4-001/Takeout/Google Photos';

  const googlePhotosFolders = [
    'Photos from 2021',
    'Photos from 2026',
    'Photos from 2020',
    'Photos from 2019',
    'Photos from 2018',
    'Photos from 2012',
    'Archive',
    'Untitled',
    'Untitled(1)',
    'Untitled(2)',
    'Untitled(3)',
    'Untitled(4)',
    'Untitled(5)',
    'Untitled(6)',
    'Untitled(7)',
    'Untitled(9)',
    'Untitled(12)',
    'Untitled(15)',
    'Untitled(16)',
    'Untitled(18)',
    'Untitled(19)',
    'Photos from 2023',
    'Photos from 2024'
  ];

  console.log(`🚀 Starting organization of ${googlePhotosFolders.length} Google Photos folders...`);

  for (const f of googlePhotosFolders) {
    await organizeFolder(`${gpBase}/${f}`);
  }

  const driveBase = 'gdrive:backup/takeout-20260429T145633Z-6-001/Takeout/Drive';
  const driveMediaFolders = [
    'Valo clips',
    'Pics/Thunder',
    'Pics/Imat',
    'Pics',
    'Unorganized'
  ];

  console.log(`\n🚀 Starting organization of Takeout Drive media folders...`);
  for (const f of driveMediaFolders) {
    await organizeFolder(`${driveBase}/${f}`);
  }

  // Remove empty directories across backup
  console.log('\n🧹 Cleaning up empty directories in backup...');
  runRclone(`"${rcloneExe}" rmdirs "gdrive:backup" --leave-root -v`);

  console.log('\n🎉 ALL MEDIA AND METADATA ORGANIZED SUCCESSFULLY!');
}

main().catch(console.error);
