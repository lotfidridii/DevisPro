const { Pool } = require('pg');

const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'homeservice',
    password: 'useradm',
    port: 5432,
});

async function testReferences() {
    const client = await pool.connect();
    
    try {
        console.log('Testing quote reference generation...');
        
        // Create sequence if it doesn't exist
        await client.query(`
            CREATE SEQUENCE IF NOT EXISTS quote_ref_seq 
            START WITH 1 
            INCREMENT BY 1 
            NO MINVALUE 
            NO MAXVALUE 
            CACHE 1;
        `);
        
        console.log('✅ Sequence created/verified');
        
        // Test reference generation for quote
        const quoteRefResult = await client.query("SELECT nextval('public.quote_ref_seq') as ref");
        const quoteRef = `D${new Date().getFullYear()}-${String(quoteRefResult.rows[0].ref).padStart(4, '0')}`;
        console.log('📄 Next quote reference would be:', quoteRef);
        
        // Test reference generation for invoice
        const invoiceRefResult = await client.query("SELECT nextval('public.quote_ref_seq') as ref");
        const invoiceRef = `F${new Date().getFullYear()}-${String(invoiceRefResult.rows[0].ref).padStart(4, '0')}`;
        console.log('🧾 Next invoice reference would be:', invoiceRef);
        
        // Check current quotes in database
        const quotesResult = await client.query(`
            SELECT id, quote_ref, document_type, created_at 
            FROM quotes 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('\n📋 Current quotes in database:');
        quotesResult.rows.forEach(row => {
            console.log(`ID: ${row.id}, Ref: ${row.quote_ref}, Type: ${row.document_type}, Date: ${row.created_at.toLocaleDateString()}`);
        });
        
        // Check if any quotes have old format
        const oldFormatResult = await client.query(`
            SELECT COUNT(*) as count 
            FROM quotes 
            WHERE quote_ref LIKE 'DEV-%' OR quote_ref NOT LIKE 'D____-____' AND quote_ref NOT LIKE 'F____-____'
        `);
        
        console.log(`\n⚠️  Quotes with old format: ${oldFormatResult.rows[0].count}`);
        
        if (oldFormatResult.rows[0].count > 0) {
            console.log('🔧 Need to update old format quotes to new sequential format');
        } else {
            console.log('✅ All quotes already have correct format');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

testReferences();
