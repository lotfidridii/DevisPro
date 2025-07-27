const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'devis',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function migrateAides() {
    const client = await pool.connect();
    
    try {
        console.log('Starting aides migration...');
        
        // Create aides table
        const createAidesTable = `
            CREATE TABLE IF NOT EXISTS aides (
                id SERIAL PRIMARY KEY,
                quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                amount NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await client.query(createAidesTable);
        console.log('✅ Aides table created successfully!');
        
        // Migrate existing deduction data to aides table
        console.log('Migrating existing deduction data...');
        
        const existingQuotes = await client.query(`
            SELECT id, deduction_prime, deduction_renov 
            FROM quotes 
            WHERE deduction_prime > 0 OR deduction_renov > 0
        `);
        
        for (const quote of existingQuotes.rows) {
            if (quote.deduction_prime > 0) {
                await client.query(`
                    INSERT INTO aides (quote_id, name, description, amount)
                    VALUES ($1, $2, $3, $4)
                `, [
                    quote.id,
                    'Prime CEE',
                    'Certificats d\'Économies d\'Énergie',
                    quote.deduction_prime
                ]);
                console.log(`✅ Migrated Prime CEE for quote ${quote.id}`);
            }
            
            if (quote.deduction_renov > 0) {
                await client.query(`
                    INSERT INTO aides (quote_id, name, description, amount)
                    VALUES ($1, $2, $3, $4)
                `, [
                    quote.id,
                    'MaPrimeRénov',
                    'Aide de l\'État pour la rénovation énergétique',
                    quote.deduction_renov
                ]);
                console.log(`✅ Migrated MaPrimeRénov for quote ${quote.id}`);
            }
        }
        
        console.log('🎉 Aides migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
migrateAides()
    .then(() => {
        console.log('Migration script finished.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
