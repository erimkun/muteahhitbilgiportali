const Database = require('../database.js');

// Check table structures first
console.log('Checking table structures...');

Database.all("PRAGMA table_info(users)", [], (err, userCols) => {
  if (err) {
    console.error('Error getting user columns:', err);
    process.exit(1);
  }
  
  console.log('\nUsers table columns:');
  userCols.forEach(col => {
    console.log(`Column: ${col.name}, Type: ${col.type}`);
  });
  
  Database.all("PRAGMA table_info(user_projects)", [], (err, upCols) => {
    if (err) {
      console.error('Error getting user_projects columns:', err);
      process.exit(1);
    }
    
    console.log('\nUser Projects table columns:');
    upCols.forEach(col => {
      console.log(`Column: ${col.name}, Type: ${col.type}`);
    });
    
    // Check actual data
    Database.all('SELECT * FROM users LIMIT 3', [], (err, users) => {
      if (err) {
        console.error('Error getting users:', err);
        process.exit(1);
      }
      
      console.log('\nSample Users:');
      console.log(users);
      
      Database.all('SELECT * FROM user_projects LIMIT 5', [], (err, userProjects) => {
        if (err) {
          console.error('Error getting user projects:', err);
          process.exit(1);
        }
        
        console.log('\nSample User Projects:');
        console.log(userProjects);
        
        process.exit(0);
      });
    });
  });
});