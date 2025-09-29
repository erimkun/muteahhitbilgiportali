const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database for migration.');
        
        // Start migration
        db.serialize(() => {
            // Create new users table without project_id
            db.run(`CREATE TABLE users_new (
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
                    console.error('Error creating new users table:', err);
                    return;
                }
                console.log('Created new users table');
                
                // Copy data from old table to new (excluding project_id)
                db.run(`INSERT INTO users_new (id, phone, password_hash, name, role, is_active, created_at, last_login)
                       SELECT id, phone, password_hash, name, role, is_active, created_at, last_login 
                       FROM users`, (err) => {
                    if (err) {
                        console.error('Error copying user data:', err);
                        return;
                    }
                    console.log('Copied user data to new table');
                    
                    // Drop old table
                    db.run('DROP TABLE users', (err) => {
                        if (err) {
                            console.error('Error dropping old users table:', err);
                            return;
                        }
                        console.log('Dropped old users table');
                        
                        // Rename new table
                        db.run('ALTER TABLE users_new RENAME TO users', (err) => {
                            if (err) {
                                console.error('Error renaming table:', err);
                                return;
                            }
                            console.log('Renamed table to users');
                            console.log('Migration completed successfully!');
                            db.close();
                        });
                    });
                });
            });
        });
    }
});