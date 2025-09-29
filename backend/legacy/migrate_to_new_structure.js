const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function moveFileSafe(src, destDir) {
  await ensureDir(destDir);
  const base = path.basename(src);
  let dest = path.join(destDir, base);
  if (fssync.existsSync(dest)) {
    const ext = path.extname(base);
    const name = path.basename(base, ext);
    let i = 1;
    while (fssync.existsSync(dest)) {
      dest = path.join(destDir, `${name} (${i})${ext}`);
      i += 1;
    }
  }
  await fs.rename(src, dest);
  return dest;
}

function pickTargetByExt(fileName) {
  const lower = fileName.toLowerCase();
  const ext = path.extname(lower);
  if (ext === '.dwg' || ext === '.dxf') return 'floor_plans_file';
  if (ext === '.zip' || ext === '.rar' || ext === '.7z') {
    if (lower.includes('fbx')) return 'fbx_model_file';
    return 'drone_photos_file';
  }
  if (ext === '.pdf') return 'other';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return null; // images remain where they are
  return 'muteahhit'; // unknowns go to contractor depot
}

async function migrateProject(projectDir) {
  const requiredDirs = [
    'drone_photos',
    'drone_photos_file',
    'floor_plans',
    'floor_plans_file',
    'orthophoto',
    'view_360',
    'fbx_model_file',
    'other',
    'muteahhit'
  ];

  // Ensure new structure exists
  for (const d of requiredDirs) {
    await ensureDir(path.join(projectDir, d));
  }

  // Helper to move all files from a directory into a target dir name (or by rule)
  async function moveAll(fromDir, decideTarget) {
    try {
      const files = await fs.readdir(fromDir);
      for (const f of files) {
        const src = path.join(fromDir, f);
        const stat = await fs.stat(src);
        if (!stat.isFile()) continue;
        const target = decideTarget(f);
        if (!target) continue;
        const destDir = path.join(projectDir, target);
        await moveFileSafe(src, destDir);
      }
      // Remove dir if empty
      const rem = await fs.readdir(fromDir);
      if (rem.length === 0) await fs.rmdir(fromDir).catch(() => {});
    } catch (_) {}
  }

  // From legacy 'files' bucket: split by extension/name
  await moveAll(path.join(projectDir, 'files'), pickTargetByExt);
  // Older buckets if present
  await moveAll(path.join(projectDir, 'files_zip'), (f) => pickTargetByExt(f));
  await moveAll(path.join(projectDir, 'models_fbx'), () => 'fbx_model_file');
  await moveAll(path.join(projectDir, 'floor_plans_dwg'), () => 'floor_plans_file');
  await moveAll(path.join(projectDir, 'documents_pdf'), () => 'other');
  await moveAll(path.join(projectDir, 'contractor_depot'), () => 'muteahhit');
}

async function main() {
  const uploadsRoot = path.join(__dirname, 'uploads', 'projects');
  try {
    const projects = await fs.readdir(uploadsRoot);
    let migrated = 0;
    for (const p of projects) {
      const projDir = path.join(uploadsRoot, p);
      try {
        const s = await fs.stat(projDir);
        if (!s.isDirectory()) continue;
        await migrateProject(projDir);
        migrated += 1;
        console.log(`✔ Migrated: ${p}`);
      } catch (e) {
        console.warn(`Skipping ${p}: ${e.message}`);
      }
    }
    console.log(`Done. Migrated ${migrated} project(s).`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

main();
