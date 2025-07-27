require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function initializeDatabase() {
    const pool = db.pool;
    const client = await pool.connect();
    console.log('Connected to the database.');

    try {
        console.log('Reading database.sql file...');
        const sqlFilePath = path.join(__dirname, 'database.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log('Executing SQL script to re-create tables...');
        await client.query(sql);
        
        console.log('Database has been successfully initialized.');

    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1); // Exit with an error code
    } finally {
        console.log('Closing database connection.');
        await client.release();
        await pool.end(); // Close all connections in the pool
    }
}

initializeDatabase();
