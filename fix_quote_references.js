const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'devis_db',
    password: 'admin',
    port: 5432,
});

async function fixQuoteReferences() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('Creating quote_ref_seq sequence if it doesn\'t exist...');
        
        // Create sequence if it doesn't exist
        await client.query(`
            CREATE SEQUENCE IF NOT EXISTS quote_ref_seq 
            START WITH 1 
            INCREMENT BY 1 
            NO MINVALUE 
            NO MAXVALUE 
            CACHE 1;
        `);
        
        console.log('Sequence created/verified.');
        
        // Get all quotes that need reference updates
        const quotesResult = await client.query(`
            SELECT id, document_type, created_at, quote_ref 
            FROM quotes 
            WHERE quote_ref IS NULL OR quote_ref NOT LIKE 'D____-____' AND quote_ref NOT LIKE 'F____-____'
            ORDER BY created_at ASC
        `);
        
        console.log(`Found ${quotesResult.rows.length} quotes that need reference updates.`);
        
        // Update each quote with proper reference format
        for (const quote of quotesResult.rows) {
            const year = new Date(quote.created_at).getFullYear();
            const seqResult = await client.query("SELECT nextval('quote_ref_seq') as ref");
            const seqNum = String(seqResult.rows[0].ref).padStart(4, '0');
            const prefix = quote.document_type === 'invoice' ? 'F' : 'D';
            const newRef = `${prefix}${year}-${seqNum}`;
            
            await client.query(
                'UPDATE quotes SET quote_ref = $1 WHERE id = $2',
                [newRef, quote.id]
            );
            
            console.log(`Updated quote ID ${quote.id}: ${quote.quote_ref || 'NULL'} → ${newRef}`);
        }
        
        await client.query('COMMIT');
        console.log('✅ All quote references have been updated successfully!');
        
        // Show updated quotes
        const updatedResult = await client.query(`
            SELECT id, quote_ref, document_type, created_at 
            FROM quotes 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log('\n📋 Recent quotes with updated references:');
        updatedResult.rows.forEach(row => {
            console.log(`ID: ${row.id}, Ref: ${row.quote_ref}, Type: ${row.document_type}, Date: ${row.created_at.toLocaleDateString()}`);
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing quote references:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixQuoteReferences();
