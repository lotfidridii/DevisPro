const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'devis',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function migrateThemeColors() {
    const client = await pool.connect();
    
    try {
        console.log('Starting theme colors migration...');
        
        // Add theme color columns to companies table
        const migrationQuery = `
            ALTER TABLE companies 
            ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(7) DEFAULT '#2563eb',
            ADD COLUMN IF NOT EXISTS theme_secondary_color VARCHAR(7) DEFAULT '#64748b',
            ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(7) DEFAULT '#059669',
            ADD COLUMN IF NOT EXISTS theme_text_color VARCHAR(7) DEFAULT '#1f2937';
        `;
        
        await client.query(migrationQuery);
        console.log('✅ Theme color columns added successfully!');
        
        // Check if there are existing companies and update them with default colors
        const existingCompanies = await client.query('SELECT id, name FROM companies');
        
        if (existingCompanies.rows.length > 0) {
            console.log(`Found ${existingCompanies.rows.length} existing companies. Updating with default theme colors...`);
            
            for (const company of existingCompanies.rows) {
                await client.query(`
                    UPDATE companies 
                    SET theme_primary_color = COALESCE(theme_primary_color, '#2563eb'),
                        theme_secondary_color = COALESCE(theme_secondary_color, '#64748b'),
                        theme_accent_color = COALESCE(theme_accent_color, '#059669'),
                        theme_text_color = COALESCE(theme_text_color, '#1f2937')
                    WHERE id = $1
                `, [company.id]);
                
                console.log(`✅ Updated theme colors for company: ${company.name}`);
            }
        } else {
            console.log('No existing companies found.');
        }
        
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
migrateThemeColors()
    .then(() => {
        console.log('Migration script finished.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
