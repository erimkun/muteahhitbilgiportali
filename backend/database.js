const sqlite3 = require('sqlite3').verbose();
const path = require('path');
// Allow overriding DB source for tests or alternate environments.
// Use an absolute path rooted at this backend folder by default so that
// starting the server from the workspace root does not create db.sqlite
// in the workspace root.
const config = require('./config/env');
const defaultDbName = (config && config.database && config.database.filename) ? config.database.filename : 'db.sqlite';
const DBSOURCE = process.env.DBSOURCE || path.join(__dirname, defaultDbName);

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
                // Add project_id column if missing
                db.run('ALTER TABLE model_versions ADD COLUMN project_id INTEGER', [], () => {
                    db.run('UPDATE model_versions SET project_id = 1 WHERE project_id IS NULL', [], () => {});
                });
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
                // Add project_id column if missing
                db.run('ALTER TABLE project_assets ADD COLUMN project_id INTEGER', [], () => {
                    db.run('UPDATE project_assets SET project_id = 1 WHERE project_id IS NULL', [], () => {});
                });
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
            } else {
                // Add project_id column if missing
                db.run('ALTER TABLE gallery_images ADD COLUMN project_id INTEGER', [], () => {
                    db.run('UPDATE gallery_images SET project_id = 1 WHERE project_id IS NULL', [], () => {});
                });
            }
        });

        // Projects table
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Failed creating projects table', err);
                // Add new columns for existing databases
                db.run('ALTER TABLE projects ADD COLUMN toplam_insaat_alan REAL', [], () => {});
                db.run('ALTER TABLE projects ADD COLUMN parsel_alan REAL', [], () => {});
                db.run('ALTER TABLE projects ADD COLUMN bina_sayisi INTEGER', [], () => {});
                db.run('ALTER TABLE projects ADD COLUMN bagimsiz_birim_sayi INTEGER', [], () => {});
            } else {
                // Table just created, add new columns
                db.run('ALTER TABLE projects ADD COLUMN toplam_insaat_alan REAL', [], () => {});
                db.run('ALTER TABLE projects ADD COLUMN parsel_alan REAL', [], () => {});
                db.run('ALTER TABLE projects ADD COLUMN bina_sayisi INTEGER', [], () => {});
                db.run('ALTER TABLE projects ADD COLUMN bagimsiz_birim_sayi INTEGER', [], () => {});
                
                // Seed default project if not present
                db.get('SELECT id FROM projects WHERE id = 1', [], (e, row) => {
                    if (!row) {
                        db.run('INSERT INTO projects (id, project_code, name, description, is_active) VALUES (1, ?, ?, ?, 1)', ['400_111', 'Project 400_111', 'Default seeded project'], () => {});
                    }
                });
                // Seed project id=2 if not present
                db.get('SELECT id FROM projects WHERE id = 2', [], (e2, row2) => {
                    if (!row2) {
                        db.run('INSERT INTO projects (id, project_code, name, description, is_active) VALUES (2, ?, ?, ?, 1)', ['917_68', 'Project 917_68', 'Second seeded project'], () => {});
                    }
                });
            }
        });

        // Project settings table for per-project viewer config
        db.run(`CREATE TABLE IF NOT EXISTS project_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            home_camera_view TEXT,
            panel_camera_view TEXT,
            corner_camera_view TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id)
        )`, (err) => {
            if (err) {
                console.error('Failed creating project_settings table', err);
            }
        });

        // Users table (end-users without direct project assignment)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'user',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Failed creating users table', err);
            } else {
                // Seed a default superadmin user if none exists (phone: 05326225500 / password: admin123)
                db.get('SELECT COUNT(*) AS c FROM users WHERE role IN (?, ?)', ['admin', 'superadmin'], (e, row) => {
                    if (!e && row && row.c === 0) {
                        const bcrypt = require('bcryptjs');
                        const hash = bcrypt.hashSync('admin123', 10);
                        db.run('INSERT INTO users (phone, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?)', 
                            ['05326225500', hash, 'System Administrator', 'superadmin', 1], 
                            function(err) {
                                if (err) {
                                    console.error('Failed to create default admin user:', err);
                                } else {
                                    console.log('Default superadmin user created successfully with ID:', this.lastID);
                                }
                            }
                        );
                    }
                });
            }
        });

        // User-Project many-to-many relationship table
        db.run(`CREATE TABLE IF NOT EXISTS user_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            permissions TEXT DEFAULT 'read',
            granted_by INTEGER,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
            FOREIGN KEY (granted_by) REFERENCES users (id),
            UNIQUE(user_id, project_id)
        )`, (err) => {
            if (err) {
                console.error('Failed creating user_projects table', err);
            }
        });
    }
});

module.exports = db;