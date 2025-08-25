const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message)
      throw err
    } else {
        console.log('Connected to the SQLite database.')
        db.run(`CREATE TABLE model_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tileset_clips TEXT,
            building_transform TEXT,
            model_clip_planes TEXT,
            logo_transform TEXT,
            is_published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        (err) => {
            if (err) {
                // Table already created
                // Ensure new columns exist for older databases
                db.run('ALTER TABLE model_versions ADD COLUMN logo_transform TEXT', [], () => {});
            } else {
                // Table just created, creating some rows
                const insert = 'INSERT INTO model_versions (tileset_clips, building_transform, model_clip_planes, logo_transform, is_published) VALUES (?,?,?,?,?)'
                db.run(insert, ["[]","{}","[]","{}", true])
            }
        });

        // Assets table to power UI cards
        db.run(`CREATE TABLE IF NOT EXISTS project_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fbx_zip_url TEXT,
            drone_photos_gallery_url TEXT,
            drone_photos_zip_url TEXT,
            drone_video_url TEXT,
            view_360_url TEXT,
            orthophoto_url TEXT,
            floor_plans_gallery_url TEXT,
            floor_plans_autocad_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Failed creating project_assets table', err);
            } else {
                // Schema evolution: add optional zip for floor plans if missing
                db.run('ALTER TABLE project_assets ADD COLUMN floor_plans_zip_url TEXT', [], () => {});
                // Seed a single empty row if table is empty
                db.get('SELECT COUNT(*) AS count FROM project_assets', [], (err, row) => {
                    if (!err && row && row.count === 0) {
                        const insertAssets = `INSERT INTO project_assets (
                            fbx_zip_url,
                            drone_photos_gallery_url,
                            drone_photos_zip_url,
                            drone_video_url,
                            view_360_url,
                            orthophoto_url,
                            floor_plans_gallery_url,
                            floor_plans_autocad_url
                        ) VALUES (?,?,?,?,?,?,?,?)`;
                        db.run(insertAssets, [null, null, null, null, null, null, null, null]);
                    }
                });
            }
        });

        // Gallery images table (albums: 'drone_photos', 'floor_plans', ...)
        db.run(`CREATE TABLE IF NOT EXISTS gallery_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            album TEXT NOT NULL,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Failed creating gallery_images table', err);
            }
        });
    }
});

module.exports = db;