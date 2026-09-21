import { execSync } from 'child_process';

const rcloneExe = 'C:\\Users\\Godwyn\\AppData\\Local\\Microsoft\\WinGet\\Links\\rclone.exe';

const looseFiles = [
  // Photos
  { name: 'IMG_7341.JPG', dest: 'Photos' },
  { name: 'IMG_8734 Copy.JPG', dest: 'Photos' },
  { name: 'IMG_9222.HEIC', dest: 'Photos' },
  { name: 'Life Schedule-images-1.jpg', dest: 'Photos' },
  { name: 'photo_28_2024-05-31_15-25-12 copy.jpg', dest: 'Photos' },
  
  // Videos
  { name: 'IMG_9873.MOV', dest: 'Videos' },
  { name: 'Ubuntu tutorial.mp4', dest: 'Videos' },
  { name: 'copy_5C4C38CF-8442-4BBD-ADA7-E23471C43209.mov', dest: 'Videos' },
  { name: 'copy_9FF4BC74-C8CB-4712-82A0-550EBF9ADBF6.mov', dest: 'Videos' },
  { name: 'copy_FFC28773-789D-4827-86A8-2C33AB50C7A1.mov', dest: 'Videos' },
  { name: 'lv_0_20241218214209.mp4', dest: 'Videos' },
  { name: 'lv_0_20241218221756.mp4', dest: 'Videos' },

  // Metadata
  { name: 'IMG_7341.JPG.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'IMG_8734 Copy.JPG.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'IMG_9222.HEIC.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'IMG_9873.MOV.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'Life Schedule-images-1.jpg.supplemental-metada.json', dest: 'Metadata' },
  { name: 'Ubuntu tutorial.mp4.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'copy_5C4C38CF-8442-4BBD-ADA7-E23471C43209.mov..json', dest: 'Metadata' },
  { name: 'copy_9FF4BC74-C8CB-4712-82A0-550EBF9ADBF6.mov..json', dest: 'Metadata' },
  { name: 'copy_FFC28773-789D-4827-86A8-2C33AB50C7A1.mov..json', dest: 'Metadata' },
  { name: 'lv_0_20241218214209.mp4.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'lv_0_20241218221756.mp4.supplemental-metadata.json', dest: 'Metadata' },
  { name: 'photo_28_2024-05-31_15-25-12 copy.jpg.suppleme.json', dest: 'Metadata' }
];

console.log(`Moving ${looseFiles.length} loose files from ye root...`);

for (const file of looseFiles) {
  try {
    const src = `gdrive:${file.name}`;
    const dst = `gdrive:${file.dest}/${file.name}`;
    console.log(`Moving "${file.name}" -> ${file.dest}...`);
    execSync(`"${rcloneExe}" moveto "${src}" "${dst}" --drive-server-side-across-configs -q`, { stdio: 'inherit' });
  } catch (err) {
    console.warn(`Could not move ${file.name}:`, err.message);
  }
}

console.log('Finished moving loose files!');
