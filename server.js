require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3001;



app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- MULTER SETUP for file uploads ---

// Create uploads directory if it doesn't exist
const logosDir = path.join(__dirname, 'public/uploads/logos');
if (!fs.existsSync(logosDir)){
    fs.mkdirSync(logosDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, logosDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// --- MIDDLEWARE ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // if there isn't any token

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'You do not have permission to perform this action.' });
        }
        next();
    };
};

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    const dbClient = await db.pool.connect();
    try {
        await dbClient.query('BEGIN');

        // Check if it's the first user
        const userCountResult = await dbClient.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(userCountResult.rows[0].count, 10);
        const role = userCount === 0 ? 'super-admin' : 'user';

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const userResult = await dbClient.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, password_hash, role]
        );

        await dbClient.query('COMMIT');
        res.status(201).json(userResult.rows[0]);

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering user. Username may already be taken.' });
    } finally {
        dbClient.release();
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            const payload = { id: user.id, username: user.username, role: user.role, companyId: user.company_id };
            const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ accessToken, user: payload });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// --- COMPANY ROUTES ---

app.get('/api/companies', authenticateToken, authorizeRole(['super-admin']), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM companies ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ message: 'Failed to fetch companies' });
    }
});

app.post('/api/companies', authenticateToken, authorizeRole(['super-admin']), upload.single('logo'), async (req, res) => {
    const { 
        name, phone, email, website, address, siret,
        theme_primary_color, theme_secondary_color, theme_accent_color, theme_text_color
    } = req.body;
    const logoPath = req.file ? `/uploads/logos/${req.file.filename}` : null;

    if (!name || !phone || !email || !website || !address) {
        return res.status(400).json({ message: 'Name, phone, email, website, and address are required.' });
    }

    try {
        const result = await db.query(
            `INSERT INTO companies (name, phone, email, website, address, siret, logo_path, 
                                   theme_primary_color, theme_secondary_color, theme_accent_color, theme_text_color) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [name, phone, email, website, address, siret, logoPath,
             theme_primary_color || '#2563eb', theme_secondary_color || '#64748b', 
             theme_accent_color || '#059669', theme_text_color || '#1f2937']
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ message: 'Failed to create company' });
    }
});

// Get individual company by ID
app.get('/api/companies/:id', authenticateToken, authorizeRole(['super-admin']), async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Company not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({ message: 'Failed to fetch company' });
    }
});

// Update company by ID
app.put('/api/companies/:id', authenticateToken, authorizeRole(['super-admin']), upload.single('logo'), async (req, res) => {
    const { id } = req.params;
    const { 
        name, phone, email, website, address, siret,
        theme_primary_color, theme_secondary_color, theme_accent_color, theme_text_color
    } = req.body;
    
    if (!name || !phone || !email || !website || !address) {
        return res.status(400).json({ message: 'Name, phone, email, website, and address are required.' });
    }
    
    try {
        // Check if company exists
        const existingCompany = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
        
        if (existingCompany.rows.length === 0) {
            return res.status(404).json({ message: 'Company not found' });
        }
        
        // Handle logo update
        let logoPath = existingCompany.rows[0].logo_path; // Keep existing logo by default
        if (req.file) {
            logoPath = `/uploads/logos/${req.file.filename}`;
        }
        
        const result = await db.query(
            `UPDATE companies SET 
                name = $1, phone = $2, email = $3, website = $4, address = $5, siret = $6, 
                logo_path = $7, theme_primary_color = $8, theme_secondary_color = $9, 
                theme_accent_color = $10, theme_text_color = $11
             WHERE id = $12 RETURNING *`,
            [name, phone, email, website, address, siret, logoPath,
             theme_primary_color || '#2563eb', theme_secondary_color || '#64748b', 
             theme_accent_color || '#059669', theme_text_color || '#1f2937', id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ message: 'Failed to update company' });
    }
});

// --- USER MANAGEMENT ROUTES ---

app.get('/api/users', authenticateToken, authorizeRole(['super-admin']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.role, u.company_id, c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.role <> 'super-admin'
            ORDER BY u.username
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

app.post('/api/users', authenticateToken, authorizeRole(['super-admin']), async (req, res) => {
    const { username, password, role, company_id } = req.body;

    if (!username || !password || !role || !company_id) {
        return res.status(400).json({ message: 'Username, password, role, and company are required.' });
    }
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ message: 'Invalid role specified. Must be admin or user.' });
    }

    try {
        const companyExists = await db.query('SELECT id FROM companies WHERE id = $1', [company_id]);
        if (companyExists.rows.length === 0) {
            return res.status(404).json({ message: 'Company not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await db.query(
            'INSERT INTO users (username, password_hash, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, company_id',
            [username, password_hash, role, company_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // unique_violation for username
            return res.status(409).json({ message: 'Username already exists.' });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Failed to create user' });
    }
});

// --- CLIENT CRUD ---

app.get('/api/clients', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM clients WHERE company_id = $1 ORDER BY name', [req.user.companyId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ message: 'Failed to fetch clients' });
    }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
    const { name, title, address, phone, email } = req.body;
    const { companyId } = req.user;

    if (!companyId) {
        return res.status(400).json({ message: 'User is not associated with a company.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO clients (name, title, address, phone, email, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, title, address, phone, email, companyId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({ message: 'Failed to add client' });
    }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, title, address, phone, email } = req.body;
    try {
        const result = await db.query(
            'UPDATE clients SET name = $1, title = $2, address = $3, phone = $4, email = $5 WHERE id = $6 AND company_id = $7 RETURNING *',
            [name, title, address, phone, email, id, req.user.companyId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found or you do not have permission to update it.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ message: 'Failed to update client' });
    }
});

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM clients WHERE id = $1 AND company_id = $2 RETURNING *', [id, req.user.companyId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Client not found or you do not have permission to delete it.' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ message: 'Failed to delete client' });
    }
});

// --- QUOTE ROUTES ---

// REMOVED: Duplicate old quote creation endpoint with timestamp references - using enhanced endpoint with sequential references below

app.get('/api/quotes', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT q.id, q.quote_ref, q.document_type, q.total_ttc, q.created_at, c.name as client_name 
             FROM quotes q 
             JOIN clients c ON q.client_id = c.id 
             WHERE q.company_id = $1
             ORDER BY q.created_at DESC`,
            [req.user.companyId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ message: 'Failed to fetch quotes' });
    }
});

// Ensure quotes directory exists
const quotesDir = path.join(__dirname, 'quotes');
if (!fs.existsSync(quotesDir)){
    fs.mkdirSync(quotesDir, { recursive: true });
}

// Nodemailer transport setup (replace with your actual email service) 
const transporter = nodemailer.createTransport({
    host: 'your-smtp-host.com', // e.g., 'smtp.gmail.com'
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'your-email@example.com', // Your email address
        pass: 'your-password' // Your email password or app-specific password
    }
});

// Fixed PDF generation with proper spacing, margins and layout improvements
const generatePdf = (quote, items, company, client, aides, callback) => {
    const doc = new PDFDocument({ 
        margin: 40,  // Set consistent margins
        size: 'A4',
        bufferPages: true  // Better page handling
    });
    
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        callback(pdfData);
    });

    // Enhanced color palette with company theme colors
    const colors = {
        primary: company.theme_primary_color || '#1E293B',
        secondary: company.theme_secondary_color || '#3B82F6',
        accent: company.theme_accent_color || '#F59E0B',
        success: '#10B981',
        white: '#FFFFFF',
        background: '#F8FAFC',
        lightGray: '#F1F5F9',
        mediumGray: '#CBD5E1',
        darkGray: '#475569',
        textPrimary: company.theme_text_color || '#0F172A',
        textSecondary: '#64748B',
        border: '#E2E8F0',
        tableHeader: company.theme_primary_color || '#1E293B',
        tableAlt: '#F8FAFC'
    };

    // Page dimensions and margins
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    // Font registration with better fallbacks
    const poppinsRegularPath = path.join(__dirname, 'public/fonts/Poppins-Regular.ttf');
    const poppinsBoldPath = path.join(__dirname, 'public/fonts/Poppins-Bold.ttf');
    const poppinsMediumPath = path.join(__dirname, 'public/fonts/Poppins-Medium.ttf');

    // Register fonts or use fallbacks
    try {
        if (fs.existsSync(poppinsRegularPath) && fs.existsSync(poppinsBoldPath)) {
            doc.registerFont('Poppins-Regular', poppinsRegularPath);
            doc.registerFont('Poppins-Bold', poppinsBoldPath);
            doc.registerFont('Poppins-Medium', fs.existsSync(poppinsMediumPath) ? poppinsMediumPath : poppinsBoldPath);
        } else {
            throw new Error('Poppins fonts not found');
        }
    } catch (error) {
        console.warn('Using Helvetica as fallback font');
        doc.registerFont('Poppins-Regular', 'Helvetica');
        doc.registerFont('Poppins-Bold', 'Helvetica-Bold');
        doc.registerFont('Poppins-Medium', 'Helvetica-Bold');
    }

    // Utility functions
    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
        });
    };

    const formatCurrency = (amount) => {
        const num = parseFloat(amount) || 0;
        return new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(num);
    };

    const addShadow = (x, y, width, height, opacity = 0.08) => {
        doc.save();
        doc.opacity(opacity);
        doc.rect(x + 1, y + 1, width, height).fill('#000000');
        doc.restore();
    };

    // Safe text rendering with proper UTF-8 encoding
    const safeText = (text, x, y, options = {}) => {
        if (!text || text === 'undefined' || text === 'null') return y;
        
        try {
            // Keep UTF-8 characters, only remove control characters
            const cleanText = String(text)
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '')  // Remove control characters only
                .replace(/\s+/g, ' ')                   // Normalize whitespace
                .trim();
            
            if (!cleanText) return y;
            
            // Default options with better line height
            const defaultOptions = {
                lineGap: 2,
                paragraphGap: 4,
                ...options
            };
            
            const result = doc.text(cleanText, x, y, defaultOptions);
            
            // Return the Y position after text for proper spacing
            return doc.y;
        } catch (error) {
            console.warn('Text rendering error:', error);
            doc.text('N/A', x, y, options);
            return doc.y;
        }
    };

    // Document type determination
    const docType = quote.document_type === 'invoice' ? 'FACTURE' : 'DEVIS';
    const docTypeColor = quote.document_type === 'invoice' ? colors.success : colors.secondary;

    // --- HEADER SECTION with proper spacing ---
    const headerHeight = 160;
    
    // Header background with proper margins
    doc.rect(0, 0, pageWidth, headerHeight).fill(colors.primary);
    
    // Company logo/name container - REMOVED WHITE BACKGROUND
    const logoX = margin;
    const logoY = 20;
    const logoWidth = 180;
    const logoHeight = 55;
    
    // Logo or company name with proper centering - NO WHITE BACKGROUND
    const logoPath = company.logo_path ? path.join(__dirname, 'public', company.logo_path) : '';
    if (logoPath && fs.existsSync(logoPath)) {
        try {
            doc.image(logoPath, logoX + 10, logoY + 10, { 
                fit: [logoWidth - 20, logoHeight - 20], 
                align: 'center', 
                valign: 'center' 
            });
        } catch (err) {
            console.error('Logo embedding error:', err);
            doc.font('Poppins-Bold').fontSize(14).fillColor(colors.white);
            safeText(company.name || 'Company', logoX + 10, logoY + 22, { 
                width: logoWidth - 20, 
                align: 'center' 
            });
        }
    } else {
        doc.font('Poppins-Bold').fontSize(14).fillColor(colors.white);
        safeText(company.name || 'Company', logoX + 10, logoY + 22, { 
            width: logoWidth - 20, 
            align: 'center' 
        });
    }

    // Company contact information with better spacing
    const contactX = margin;
    const contactY = logoY + logoHeight + 15;
    let currentContactY = contactY;
    
    doc.font('Poppins-Regular').fontSize(8).fillColor(colors.white);
    
    const drawContactInfo = (prefix, text) => {
        if (!text) return;
        
        // Small bullet point
        doc.circle(contactX + 4, currentContactY + 4, 1.5).fill(colors.accent);
        
        // Contact text with proper spacing
        doc.font('Poppins-Regular').fontSize(8).fillColor(colors.white);
        safeText(`${prefix} ${text}`, contactX + 12, currentContactY, { width: 280 });
        currentContactY += 12; // Consistent line spacing
    };

    // Add contact info with consistent spacing
    drawContactInfo('Tél:', company.phone);
    drawContactInfo('Email:', company.email);
    drawContactInfo('Web:', company.website);
    drawContactInfo('Adresse:', company.address);

    // Document type badge - properly positioned
    const badgeX = pageWidth - margin - 140;
    const badgeY = 20;
    const badgeWidth = 120;
    const badgeHeight = 40;
    
    addShadow(badgeX, badgeY, badgeWidth, badgeHeight);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 8).fill(docTypeColor);
    doc.font('Poppins-Bold').fontSize(18).fillColor(colors.white);
    safeText(docType, badgeX, badgeY + 10, { width: badgeWidth, align: 'center' });

    // Document details with proper alignment
    const detailsX = badgeX - 20;
    const detailsY = badgeY + badgeHeight + 15;
    
    doc.font('Poppins-Regular').fontSize(8).fillColor(colors.white);
    
    const addDetailRow = (label, value, y) => {
        doc.font('Poppins-Regular').fontSize(8).fillColor(colors.mediumGray);
        safeText(label, detailsX, y);
        doc.font('Poppins-Medium').fontSize(9).fillColor(colors.white);
        safeText(value, detailsX + 70, y, { width: 100, align: 'right' });
    };

    addDetailRow(`${docType} N°:`, quote.quote_ref || 'N/A', detailsY);
    addDetailRow('Date:', formatDate(quote.created_at), detailsY + 12);
    //addDetailRow('Échéance:', formatDate(quote.due_date), detailsY + 24);

    // --- CLIENT SECTION with proper spacing ---
    let currentY = headerHeight + 25;
    
    // Client section header
    doc.font('Poppins-Medium').fontSize(10).fillColor(colors.textSecondary);
    safeText('ADRESSÉ À', margin, currentY);
    
    // Client info container with better dimensions
    const clientBoxY = currentY + 15;
    const clientBoxHeight = 65;
    
    doc.rect(margin, clientBoxY, contentWidth, clientBoxHeight).fill(colors.lightGray);
    doc.rect(margin, clientBoxY, contentWidth, clientBoxHeight).stroke(colors.border);
    
    // Client details with proper spacing
    const clientPadding = 12;
    doc.font('Poppins-Bold').fontSize(12).fillColor(colors.textPrimary);
    let clientY = safeText(client.name || 'Client Name', margin + clientPadding, clientBoxY + clientPadding);
    
    if (client.title) {
        doc.font('Poppins-Regular').fontSize(9).fillColor(colors.textSecondary);
        clientY = safeText(client.title, margin + clientPadding, clientY + 2);
    }
    
    // Client contact info - right aligned with proper spacing
    const clientContactX = pageWidth - margin - 200;
    let clientContactY = clientBoxY + clientPadding;
    
    doc.font('Poppins-Regular').fontSize(8).fillColor(colors.textSecondary);
    
    if (client.phone) {
        clientContactY = safeText(`Tél: ${client.phone}`, clientContactX, clientContactY);
        clientContactY += 2;
    }
    if (client.email) {
        clientContactY = safeText(`Email: ${client.email}`, clientContactX, clientContactY, { width: 180 });
        clientContactY += 2;
    }
    if (client.address) {
        safeText(`Adresse: ${client.address}`, clientContactX, clientContactY, { width: 180 });
    }

    currentY = clientBoxY + clientBoxHeight + 25;

    // --- ITEMS TABLE with fixed spacing ---
    const tableTop = currentY;
    const tableHeaderHeight = 30;
    
    // Table header background
    doc.rect(margin, tableTop, contentWidth, tableHeaderHeight).fill(colors.tableHeader);
    
    // Optimized column widths for better fit
    const columnWidths = {
        description: Math.floor(contentWidth * 0.50), // 50%
        quantity: Math.floor(contentWidth * 0.10),    // 10%
        unit_price: Math.floor(contentWidth * 0.20),  // 20%
        total: Math.floor(contentWidth * 0.20)        // 20%
    };
    
    // Table headers with proper positioning
    doc.font('Poppins-Bold').fontSize(9).fillColor(colors.white);
    const headerY = tableTop + 10;
    
    let headerX = margin + 8;
    safeText('DESCRIPTION', headerX, headerY);
    
    headerX += columnWidths.description;
    safeText('QTÉ', headerX, headerY, { width: columnWidths.quantity, align: 'center' });
    
    headerX += columnWidths.quantity;
    safeText('PRIX UNIT. HT', headerX, headerY, { width: columnWidths.unit_price, align: 'center' });
    
    headerX += columnWidths.unit_price;
    safeText('TOTAL HT', headerX, headerY, { width: columnWidths.total, align: 'center' });

    // Table rows with proper spacing and FIXED CALCULATIONS
    currentY = tableTop + tableHeaderHeight;
    let isAlternate = false;
    let calculatedSubtotal = 0; // Track calculated subtotal
    
    items.forEach((item, index) => {
        const rowPadding = 8;
        const startY = currentY;

        // If we are too close to the bottom, jump to the next page.
        if (startY > pageHeight - 100) {
            doc.addPage();
            currentY = margin;
            isAlternate = false;
            return; // Restart the iteration with the new page
        }

        const contentY = currentY + rowPadding;
        const description = item.description || '';
        
        // Calculate the height of the description text
        const descriptionHeight = doc.heightOfString(description, { 
            width: columnWidths.description - 16, 
            lineGap: 1 
        }) + rowPadding * 2;
        
        // Use a minimum row height that fits the other columns
        const minRowHeight = 25; // Enough for quantity, price, and total
        const rowHeight = Math.max(descriptionHeight, minRowHeight);
        
        // FIXED CALCULATION: Calculate item total correctly
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const itemTotal = quantity * unitPrice;
        calculatedSubtotal += itemTotal;
        
        // Draw the background and border first (on the current page only)
        if (isAlternate) {
            doc.rect(margin, startY, contentWidth, rowHeight).fill(colors.tableAlt);
        }
        doc.rect(margin, startY, contentWidth, rowHeight).stroke(colors.border);
        
        // Draw the static columns (Quantity, Price, Total)
        const otherColsX = margin + columnWidths.description;
        doc.font('Poppins-Regular').fontSize(8).fillColor(colors.textPrimary);
        safeText(quantity.toFixed(2), otherColsX, contentY, { 
            width: columnWidths.quantity, 
            align: 'center' 
        });
        safeText(formatCurrency(unitPrice), otherColsX + columnWidths.quantity, contentY, { 
            width: columnWidths.unit_price, 
            align: 'center' 
        });
        safeText(formatCurrency(itemTotal), 
                otherColsX + columnWidths.quantity + columnWidths.unit_price, 
                contentY, { 
                    width: columnWidths.total, 
                    align: 'center' 
                });
        
        // Draw the description, letting it flow naturally
        doc.text(description, margin + rowPadding, contentY, { 
            width: columnWidths.description - 16, 
            lineGap: 1, 
            align: 'left' 
        });
        
        // Update the current Y position for the next item
        currentY = startY + rowHeight;
        isAlternate = !isAlternate;
    });

    // --- FINANCIAL AID SECTION (Dynamic Aides) ---
    // Use dynamic aides instead of hardcoded deductions
    const dynamicAides = aides || [];

    if (dynamicAides.length > 0) {
        currentY += 20;
        doc.font('Poppins-Medium').fontSize(10).fillColor(colors.textPrimary);
        safeText('AIDES FINANCIÈRES', margin, currentY);
        currentY += 15;

        const addAidSection = (title, description, amount) => {
            doc.font('Poppins-Bold').fontSize(9).fillColor(colors.textPrimary);
            const titleHeight = doc.heightOfString(title, { width: contentWidth - 100 });
            safeText(title, margin, currentY);

            doc.font('Poppins-Regular').fontSize(9).fillColor(colors.textPrimary);
            safeText(`- ${formatCurrency(amount)}`, margin, currentY, { width: contentWidth, align: 'right' });

            currentY += titleHeight;

            if (description && description.trim()) {
                doc.font('Poppins-Regular').fontSize(8).fillColor(colors.textSecondary);
                const descHeight = doc.heightOfString(description, { width: contentWidth - 100 });
                safeText(description, margin, currentY, { width: contentWidth - 100 });
                currentY += descHeight + 15;
            } else {
                currentY += 15;
            }
            doc.moveTo(margin, currentY - 8).lineTo(contentWidth + margin, currentY - 8).stroke(colors.border);
        };

        // Add each dynamic aide
        dynamicAides.forEach(aide => {
            if (aide.amount > 0) {
                addAidSection(aide.name, aide.description || '', parseFloat(aide.amount));
            }
        });
    }

    // --- TOTALS SECTION with FIXED CALCULATIONS ---
    currentY += 20;
    
    // Totals container - properly positioned
    const totalsWidth = 180;
    const totalsX = pageWidth - margin - totalsWidth;
    
    // FIXED CALCULATIONS: Use calculated subtotal and recalculate everything
    const totalHt = calculatedSubtotal; // Use our calculated subtotal
    // Get TVA rate from the first item, or default to 20% if no items
    const tvaRate = items && items.length > 0 ? parseFloat(items[0].tva_rate) : 20;
    const totalTva = totalHt * (tvaRate / 100);
    const totalAvantAides = totalHt + totalTva;
    const totalAides = dynamicAides.reduce((sum, aide) => sum + (parseFloat(aide.amount) || 0), 0);
    const totalTtc = totalAvantAides - totalAides;
    
    // Totals background with proper height
    const totalsHeight = 15 + (totalAides > 0 ? 75 : 60) + 15; // Adjust height if aid exists
    doc.rect(totalsX, currentY, totalsWidth, totalsHeight).fill(colors.lightGray);
    doc.rect(totalsX, currentY, totalsWidth, totalsHeight).stroke(colors.border);
    
    let totalsY = currentY + 12;
    
    const addTotalRow = (label, value, isFinal = false) => {
        const font = isFinal ? 'Poppins-Bold' : 'Poppins-Regular';
        const fontSize = isFinal ? 10 : 8;
        const textColor = isFinal ? colors.textPrimary : colors.textSecondary;
        
        doc.font(font).fontSize(fontSize).fillColor(textColor);
        safeText(label, totalsX + 10, totalsY);
        safeText(value, totalsX + 10, totalsY, { width: totalsWidth - 20, align: 'right' });
        
        if (isFinal) {
            // Underline for final total
            doc.moveTo(totalsX + 10, totalsY + 13)
               .lineTo(totalsX + totalsWidth - 10, totalsY + 13)
               .stroke(colors.textPrimary);
        }
        
        totalsY += isFinal ? 18 : 12;
    };
    
    addTotalRow('Sous-total HT:', formatCurrency(totalHt));
    addTotalRow(`TVA (${tvaRate}%):`, formatCurrency(totalTva));
    addTotalRow('Total TTC:', formatCurrency(totalAvantAides));

    if (totalAides > 0) {
        addTotalRow('Aides financières:', `- ${formatCurrency(totalAides)}`);
    }
    
    addTotalRow('TOTAL À PAYER:', formatCurrency(totalTtc), true);

    // --- FOOTER with proper positioning ---
    const footerStartY = pageHeight - 140;
    
    // Payment terms section
    doc.font('Poppins-Medium').fontSize(9).fillColor(colors.textPrimary);
    safeText('CONDITIONS DE PAIEMENT', margin, footerStartY);
    
    let footerY = footerStartY + 15;
    doc.font('Poppins-Regular').fontSize(7).fillColor(colors.textSecondary);
    
    // Footer information with consistent spacing
    const footerInfo = [
        'Règlement par chèque ou par virement bancaire',
        quote.down_payment_text,
        quote.iban ? `IBAN: ${quote.iban}` : null,
        quote.installer_ref ? `Référence installateur: ${quote.installer_ref}` : null,
        quote.capacity_attestation_no ? `Attestation de capacité n° ${quote.capacity_attestation_no}` : null,
        quote.civil_liability_insurance ? `Assurance responsabilité civile: ${quote.civil_liability_insurance}` : null
    ].filter(Boolean);
    
    footerInfo.forEach(text => {
        footerY = safeText(text, margin, footerY, { width: 300 });
        footerY += 2; // Consistent line spacing
    });
    
    // Add footer notes if they exist
    if (quote.footer_notes) {
        footerY += 10; // Add some space before the notes
        doc.font('Poppins-Regular').fontSize(7).fillColor(colors.textSecondary);
        // Use PDFKit's text wrapping with width and height constraints
        const textHeight = doc.heightOfString(quote.footer_notes, {
            width: 300,
            align: 'left'
        });
        
        // Draw text with wrapping
        doc.text(quote.footer_notes, margin, footerY, {
            width: 300,
            align: 'left',
            lineGap: 2
        });
        
        footerY += textHeight + 4; // Move down by the height of the text plus some spacing
    }
    
    // Signature section - properly positioned
    const signatureX = pageWidth - margin - 160;
    const signatureY = footerStartY + 12;
    
    doc.font('Poppins-Regular').fontSize(8).fillColor(colors.textSecondary);
    safeText('Bon pour accord, lu et approuvé', signatureX, signatureY);
    
    // Signature line with proper spacing
    const signatureLineY = signatureY + 25;
    doc.moveTo(signatureX, signatureLineY)
       .lineTo(signatureX + 140, signatureLineY)
       .stroke(colors.textSecondary);
    
    doc.font('Poppins-Regular').fontSize(6).fillColor(colors.textSecondary);
    safeText('Signature et date', signatureX + 35, signatureLineY + 5);
    
    // Bottom accent bar
    doc.rect(0, pageHeight - 6, pageWidth, 6).fill(colors.primary);

    doc.end();
};

// Enhanced API endpoints with better error handling
app.post('/api/quotes', authenticateToken, async (req, res) => {
    const { client_id, document_type, items, aides, down_payment_text, iban, installer_ref, capacity_attestation_no, civil_liability_insurance, footer_notes } = req.body;
    const { companyId } = req.user;
    
    // Debug logging
    console.log('Received aides data:', aides);
    console.log('Aides type:', typeof aides);
    console.log('Aides is array:', Array.isArray(aides));

    // Validation
    if (!client_id || !document_type || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
            message: 'Client, document type, and at least one item are required.',
            errors: {
                client_id: !client_id ? 'Client is required' : null,
                document_type: !document_type ? 'Document type is required' : null,
                items: (!items || !Array.isArray(items) || items.length === 0) ? 'At least one item is required' : null
            }
        });
    }

    const dbClient = await db.pool.connect();
    try {
        await dbClient.query('BEGIN');

        // Generate quote reference
        const quoteRefResult = await dbClient.query("SELECT nextval('public.quote_ref_seq') as ref");
        const quoteRef = `${document_type === 'invoice' ? 'F' : 'D'}${new Date().getFullYear()}-${String(quoteRefResult.rows[0].ref).padStart(4, '0')}`;

        // Process and validate items
        const processedItems = items.map((item, index) => {
            const processed = {
                ...item,
                quantity: parseInt(item.quantity, 10) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                tva_rate: (item.tva_rate === undefined || item.tva_rate === null) ? 20.00 : parseFloat(item.tva_rate)
            };

            // Validation
            if (!processed.description || processed.description.trim() === '') {
                throw new Error(`Item ${index + 1}: Description is required`);
            }
            if (processed.quantity <= 0) {
                throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
            }
            if (processed.unit_price < 0) {
                throw new Error(`Item ${index + 1}: Unit price cannot be negative`);
            }

            return processed;
        });

        // Calculate totals
        let totalHt = 0;
        let totalTva = 0;

        processedItems.forEach(item => {
            const itemHt = item.unit_price * item.quantity;
            const itemTva = itemHt * (item.tva_rate / 100);
            totalHt += itemHt;
            totalTva += itemTva;
        });

        // Calculate total aides amount
        const totalAides = Array.isArray(aides) ? aides.reduce((sum, aide) => sum + (parseFloat(aide.amount) || 0), 0) : 0;
        console.log(`Total HT before aides: ${totalHt}, Total aides: ${totalAides}`);
        
        // Apply aides deductions
        const finalTotalHt = totalHt - totalAides;
        console.log(`Final HT after aides deduction: ${finalTotalHt}`);
        const finalTotalTtc = finalTotalHt + totalTva;

        // Calculate the first non-null TVA rate from items, or default to 20
        const firstTvaRate = processedItems.length > 0 ? 
            (processedItems[0].tva_rate !== undefined && processedItems[0].tva_rate !== null ? parseFloat(processedItems[0].tva_rate) : 20.00) : 
            20.00;
            
        // Insert quote (remove old deduction fields)
        const quoteResult = await dbClient.query(
            `INSERT INTO quotes (client_id, company_id, quote_ref, document_type, total_ht, total_tva, total_ttc, created_at, down_payment_text, iban, installer_ref, capacity_attestation_no, civil_liability_insurance, footer_notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13) RETURNING *`,
            [client_id, companyId, quoteRef, document_type, finalTotalHt, totalTva, finalTotalTtc, down_payment_text, iban, installer_ref, capacity_attestation_no, civil_liability_insurance, footer_notes || null]
        );
        
        const newQuote = quoteResult.rows[0];

        // Insert items
        const itemPromises = processedItems.map(item => {
            return dbClient.query(
                `INSERT INTO quote_items (quote_id, description, quantity, unit_price, tva_rate) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [newQuote.id, item.description, item.quantity, item.unit_price, item.tva_rate]
            );
        });
        
        await Promise.all(itemPromises);
        
        // Insert aides if any
        if (Array.isArray(aides) && aides.length > 0) {
            console.log(`Inserting ${aides.length} aides for quote ${newQuote.id}`);
            const aidesPromises = aides.map((aide, index) => {
                console.log(`Aide ${index + 1}:`, aide);
                return dbClient.query(
                    `INSERT INTO aides (quote_id, name, description, amount) 
                     VALUES ($1, $2, $3, $4)`,
                    [newQuote.id, aide.name, aide.description || '', parseFloat(aide.amount) || 0]
                );
            });
            await Promise.all(aidesPromises);
            console.log('All aides inserted successfully');
        } else {
            console.log('No aides to insert or aides is not an array:', aides);
        }
        
        await dbClient.query('COMMIT');
        
        res.status(201).json({
            ...newQuote,
            items: processedItems,
            aides: aides || []
        });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error creating quote:', error);
        res.status(500).json({ 
            message: 'Failed to create quote',
            error: error.message 
        });
    } finally {
        dbClient.release();
    }
});

// PUT endpoint to update an existing quote
app.put('/api/quotes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { client_id, document_type, items, aides, down_payment_text, iban, installer_ref, capacity_attestation_no, civil_liability_insurance, footer_notes } = req.body;
    const { companyId } = req.user;
    
    // Debug logging
    console.log('Updating quote ID:', id);
    console.log('Received aides data for update:', aides);
    console.log('Aides type:', typeof aides);
    console.log('Aides is array:', Array.isArray(aides));

    // Validation
    if (!client_id || !document_type || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
            message: 'Client, document type, and at least one item are required.',
            errors: {
                client_id: !client_id ? 'Client is required' : null,
                document_type: !document_type ? 'Document type is required' : null,
                items: (!items || !Array.isArray(items) || items.length === 0) ? 'At least one item is required' : null
            }
        });
    }

    const dbClient = await db.pool.connect();
    try {
        await dbClient.query('BEGIN');

        // First, verify the quote exists and belongs to the user's company
        const existingQuoteResult = await dbClient.query(
            'SELECT * FROM quotes WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );
        
        if (existingQuoteResult.rows.length === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ message: 'Quote not found or you do not have permission to update it.' });
        }
        
        const existingQuote = existingQuoteResult.rows[0];

        // Process and validate items
        const processedItems = items.map((item, index) => {
            const processed = {
                ...item,
                quantity: parseInt(item.quantity, 10) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                tva_rate: parseFloat(item.tva_rate) || 20.00
            };

            // Validation
            if (!processed.description || processed.description.trim() === '') {
                throw new Error(`Item ${index + 1}: Description is required`);
            }
            if (processed.quantity <= 0) {
                throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
            }
            if (processed.unit_price < 0) {
                throw new Error(`Item ${index + 1}: Unit price cannot be negative`);
            }

            return processed;
        });

        // Calculate totals
        let totalHt = 0;
        let totalTva = 0;
        processedItems.forEach(item => {
            const itemHt = item.unit_price * item.quantity;
            const itemTva = itemHt * (item.tva_rate / 100);
            totalHt += itemHt;
            totalTva += itemTva;
        });

        // Calculate total aides amount
        const totalAides = Array.isArray(aides) ? aides.reduce((sum, aide) => sum + (parseFloat(aide.amount) || 0), 0) : 0;
        console.log(`Total HT before aides: ${totalHt}, Total aides: ${totalAides}`);
        
        // Apply aides deductions
        const finalTotalHt = totalHt - totalAides;
        console.log(`Final HT after aides deduction: ${finalTotalHt}`);
        const finalTotalTtc = finalTotalHt + totalTva;

        // Update quote (keep existing quote_ref) - match the schema from POST endpoint
        const updateQuoteResult = await dbClient.query(
            `UPDATE quotes SET 
                client_id = $1, document_type = $2, total_ht = $3, total_tva = $4, total_ttc = $5,
                down_payment_text = $6, iban = $7, installer_ref = $8, capacity_attestation_no = $9, 
                civil_liability_insurance = $10, footer_notes = $11
             WHERE id = $12 AND company_id = $13 RETURNING *`,
            [
                client_id, document_type, finalTotalHt, totalTva, finalTotalTtc,
                down_payment_text, iban, installer_ref, capacity_attestation_no, 
                civil_liability_insurance, footer_notes, id, companyId
            ]
        );
        
        const updatedQuote = updateQuoteResult.rows[0];
        console.log('Quote updated:', updatedQuote.id, updatedQuote.quote_ref);

        // Delete existing quote items and aides
        await dbClient.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);
        await dbClient.query('DELETE FROM aides WHERE quote_id = $1', [id]);

        // Insert new quote items
        const itemsPromises = processedItems.map((item, index) => {
            console.log(`Inserting item ${index + 1}:`, item);
            return dbClient.query(
                `INSERT INTO quote_items (quote_id, description, quantity, unit_price, tva_rate) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, item.description, item.quantity, item.unit_price, item.tva_rate]
            );
        });
        await Promise.all(itemsPromises);
        console.log('All items updated successfully');

        // Insert new aides if provided
        if (Array.isArray(aides) && aides.length > 0) {
            console.log(`Inserting ${aides.length} aides for quote ${id}`);
            const aidesPromises = aides.map((aide, index) => {
                console.log(`Aide ${index + 1}:`, aide);
                return dbClient.query(
                    `INSERT INTO aides (quote_id, name, description, amount) 
                     VALUES ($1, $2, $3, $4)`,
                    [id, aide.name, aide.description || '', parseFloat(aide.amount) || 0]
                );
            });
            await Promise.all(aidesPromises);
            console.log('All aides updated successfully');
        } else {
            console.log('No aides to insert or aides is not an array:', aides);
        }
        
        await dbClient.query('COMMIT');
        
        res.json({
            ...updatedQuote,
            items: processedItems,
            aides: aides || []
        });
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error updating quote:', error);
        res.status(500).json({ 
            message: 'Failed to update quote',
            error: error.message 
        });
    } finally {
        dbClient.release();
    }
});

// Get aides for a specific quote
app.get('/api/quotes/:id/aides', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;

    try {
        // First verify the quote belongs to the user's company
        const quoteCheck = await db.query(
            'SELECT id FROM quotes WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );

        if (quoteCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        // Fetch aides for this quote
        const aidesResult = await db.query(
            'SELECT name, description, amount FROM aides WHERE quote_id = $1 ORDER BY id',
            [id]
        );

        res.json(aidesResult.rows);
    } catch (error) {
        console.error('Error fetching aides:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/quotes/:id/download', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;

    try {
        // Fetch all required data
        const [quoteRes, itemsRes, companyRes] = await Promise.all([
            db.query('SELECT * FROM quotes WHERE id = $1 AND company_id = $2', [id, companyId]),
            db.query('SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY id', [id]),
            db.query('SELECT * FROM companies WHERE id = $1', [companyId])
        ]);

        if (quoteRes.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const quote = quoteRes.rows[0];
        const clientRes = await db.query('SELECT * FROM clients WHERE id = $1', [quote.client_id]);

        if (clientRes.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }

        const items = itemsRes.rows;
        const company = companyRes.rows[0];
        const client = clientRes.rows[0];

        const cleanDocType = String(quote.document_type).trim();
        const cleanQuoteRef = String(quote.quote_ref).trim().replace(/[^\w\-]/g, '_'); // sanitize

        const fileName = `${cleanDocType}_${cleanQuoteRef}.pdf`;
        const filePath = path.join(__dirname, 'quotes', fileName);
        
        // Fetch aides for this quote
        const aidesRes = await db.query('SELECT * FROM aides WHERE quote_id = $1 ORDER BY id', [id]);
        const aides = aidesRes.rows;

        generatePdf(quote, items, company, client, aides, (pdfData) => {
            try {
                fs.writeFileSync(filePath, pdfData);
                res.download(filePath, fileName, (err) => {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('Error deleting PDF:', unlinkErr);
                        }
                    });

                    if (err && !res.headersSent) {
                        console.error('Download error:', err);
                        res.status(500).send('Could not download the file.');
                    }
                });

            } catch (error) {
                console.error('PDF save error:', error);
                res.status(500).json({ message: 'Failed to save PDF' });
            }
        });

    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({ message: 'Error generating PDF' });
    }
});


app.post('/api/quotes/:id/send', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const { customMessage } = req.body;

    try {
        // Fetch all required data
        const [quoteRes, itemsRes, companyRes] = await Promise.all([
            db.query('SELECT * FROM quotes WHERE id = $1 AND company_id = $2', [id, companyId]),
            db.query('SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY id', [id]),
            db.query('SELECT * FROM companies WHERE id = $1', [companyId])
        ]);

        if (quoteRes.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const quote = quoteRes.rows[0];
        const clientRes = await db.query('SELECT * FROM clients WHERE id = $1', [quote.client_id]);

        if (clientRes.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }

        const items = itemsRes.rows;
        const company = companyRes.rows[0];
        const client = clientRes.rows[0];

        if (!client.email) {
            return res.status(400).json({ message: "Client does not have an email address" });
        }
        
        // Fetch aides for this quote
        const aidesRes = await db.query('SELECT * FROM aides WHERE quote_id = $1 ORDER BY id', [id]);
        const aides = aidesRes.rows;

        generatePdf(quote, items, company, client, aides, async (pdfData) => {
            const docType = quote.document_type === 'invoice' ? 'Facture' : 'Devis';
            const defaultMessage = `Bonjour ${client.name},\n\nVeuillez trouver ci-joint votre ${docType.toLowerCase()} ${quote.quote_ref}.\n\nN'hésitez pas à nous contacter si vous avez des questions.\n\nCordialement,\n${company.name}`;

            const mailOptions = {
                from: `"${company.name}" <${company.email || 'noreply@example.com'}>`,
                to: client.email,
                subject: `Votre ${docType} ${quote.quote_ref} - ${company.name}`,
                text: customMessage || defaultMessage,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2B3A67;">Bonjour ${client.name},</h2>
                        <p>Veuillez trouver ci-joint votre ${docType.toLowerCase()} <strong>${quote.quote_ref}</strong>.</p>
                        <p>${customMessage ? customMessage.replace(/\n/g, '<br>') : "N'hésitez pas à nous contacter si vous avez des questions."}</p>
                        <p>Cordialement,<br><strong>${company.name}</strong></p>
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #E5E7EB;">
                        <p style="font-size: 12px; color: #6B7280;">
                            ${company.phone ? `Téléphone: ${company.phone}<br>` : ''}
                            ${company.email ? `Email: ${company.email}<br>` : ''}
                            ${company.address ? `Adresse: ${company.address}` : ''}
                        </p>
                    </div>
                `,
                attachments: [{
                    filename: `${docType.trim()}_${String(quote.quote_ref).trim()}.pdf`,
                    content: pdfData,
                    contentType: 'application/pdf'
                }]
            };

            try {
                await transporter.sendMail(mailOptions);
                
                // Update quote status to sent
                await db.query(
                    'UPDATE quotes SET status = $1, sent_at = NOW() WHERE id = $2',
                    ['sent', id]
                );
                
                res.json({ 
                    message: 'Email sent successfully',
                    sent_to: client.email,
                    sent_at: new Date().toISOString()
                });
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                res.status(500).json({ 
                    message: 'Failed to send email',
                    error: emailError.message 
                });
            }
        });

    } catch (dbError) {
        console.error('Error preparing to send email:', dbError);
        res.status(500).json({ 
            message: 'Server error while preparing email',
            error: dbError.message 
        });
    }
});

// Preview quote as PDF
app.get('/api/quotes/:id/preview', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;

    try {
        // Get quote data
        const quoteResult = await db.query(
            `SELECT q.*, c.name as client_name, c.email as client_email, c.address as client_address, 
                    c.phone as client_phone, c.title as client_title,
                    comp.name as company_name, comp.address as company_address, 
                    comp.phone as company_phone, comp.email as company_email,
                    comp.siret as company_siret, comp.website as company_website,
                    comp.logo_path as company_logo_path,
                    comp.theme_primary_color, comp.theme_secondary_color, 
                    comp.theme_accent_color, comp.theme_text_color
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             JOIN companies comp ON q.company_id = comp.id
             WHERE q.id = $1 AND q.company_id = $2`,
            [id, companyId]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const quote = quoteResult.rows[0];

        // Get quote items
        const itemsResult = await db.query(
            'SELECT * FROM quote_items WHERE quote_id = $1',
            [id]
        );
        
        // Get aides for this quote
        const aidesResult = await db.query(
            'SELECT * FROM aides WHERE quote_id = $1 ORDER BY id',
            [id]
        );

        // Generate PDF as buffer
        const pdfBuffer = await new Promise((resolve, reject) => {
            generatePdf(quote, itemsResult.rows, {
                name: quote.company_name,
                address: quote.company_address,
                phone: quote.company_phone,
                email: quote.company_email,
                siret: quote.company_siret,
                website: quote.company_website,
                logo_path: quote.company_logo_path,
                theme_primary_color: quote.theme_primary_color,
                theme_secondary_color: quote.theme_secondary_color,
                theme_accent_color: quote.theme_accent_color,
                theme_text_color: quote.theme_text_color
            }, {
                name: quote.client_name,
                email: quote.client_email,
                address: quote.client_address,
                phone: quote.client_phone,
                title: quote.client_title
            }, aidesResult.rows, (pdfData) => {
                resolve(pdfData);
            });
        });

        // Convert to base64
        const base64Pdf = pdfBuffer.toString('base64');
        res.json({ pdf: base64Pdf });

    } catch (error) {
        console.error('Error generating PDF preview:', error);
        res.status(500).json({ message: 'Error generating PDF preview', error: error.message });
    }
});

// REMOVED: Duplicate simple endpoint - using enhanced endpoint with items/aides below

// GET quote items
app.get('/api/quotes/:id/items', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;

    try {
        // Verify quote belongs to user's company
        const quoteCheck = await db.query(
            'SELECT id FROM quotes WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );

        if (quoteCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const result = await db.query(
            'SELECT * FROM quote_items WHERE quote_id = $1',
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching quote items:', error);
        res.status(500).json({ message: 'Error fetching quote items' });
    }
});

// GET quote PDF download
app.get('/api/quotes/:id/download', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;

    try {
        // Verify quote belongs to user's company and get quote data
        const quoteResult = await db.query(
            `SELECT q.*, c.name as client_name, c.email as client_email, c.address as client_address, 
                    c.phone as client_phone, c.title as client_title
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             WHERE q.id = $1 AND q.company_id = $2`,
            [id, companyId]
        );

        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const quote = quoteResult.rows[0];

        // Get quote items
        const itemsResult = await db.query(
            'SELECT * FROM quote_items WHERE quote_id = $1',
            [id]
        );

        const items = itemsResult.rows;

        // Get company information
        const companyResult = await db.query(
            'SELECT name, address, phone, email, website, logo_path, theme_primary_color, theme_secondary_color, theme_accent_color, theme_text_color FROM companies WHERE id = $1',
            [companyId]
        );

        if (companyResult.rows.length === 0) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const company = companyResult.rows[0];
        const client = {
            name: quote.client_name,
            email: quote.client_email,
            address: quote.client_address,
            phone: quote.client_phone,
            title: quote.client_title
        };

        // Generate PDF
        generatePdf(quote, items, company, client, (pdfBuffer) => {
            const filename = `${quote.document_type}_${quote.quote_ref || quote.id}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            res.send(pdfBuffer);
        });

    } catch (error) {
        console.error('Error generating PDF for download:', error);
        res.status(500).json({ message: 'Error generating PDF for download' });
    }
});

// GET individual quote by ID with items and aides
app.get('/api/quotes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    
    console.log(`🔍 GET /api/quotes/${id} - Fetching quote for company ${companyId}`);
    
    try {
        // Get quote basic information
        const quoteResult = await db.query(
            `SELECT q.*, c.name as client_name, c.email as client_email 
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             WHERE q.id = $1 AND q.company_id = $2`,
            [id, companyId]
        );
        
        if (quoteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Quote not found' });
        }
        
        const quote = quoteResult.rows[0];
        
        // Get quote items
        console.log(`🔍 Querying items for quote_id: ${id}`);
        const itemsResult = await db.query(
            'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY id',
            [id]
        );
        console.log(`📦 Found ${itemsResult.rows.length} items for quote ${id}:`, itemsResult.rows);
        
        // Get aides
        console.log(`🔍 Querying aides for quote_id: ${id}`);
        const aidesResult = await db.query(
            'SELECT * FROM aides WHERE quote_id = $1 ORDER BY id',
            [id]
        );
        console.log(`🎯 Found ${aidesResult.rows.length} aides for quote ${id}:`, aidesResult.rows);
        
        // Combine all data
        const completeQuote = {
            ...quote,
            items: itemsResult.rows,
            aides: aidesResult.rows
        };
        
        console.log('📋 Complete quote object being sent:', {
            id: completeQuote.id,
            quote_ref: completeQuote.quote_ref,
            itemsCount: completeQuote.items.length,
            aidesCount: completeQuote.aides.length
        });
        
        res.json(completeQuote);
        
    } catch (error) {
        console.error('Error fetching quote by ID:', error);
        res.status(500).json({ message: 'Error fetching quote' });
    }
});

// GET all quotes for the company
app.get('/api/quotes', authenticateToken, async (req, res) => {
    const { companyId } = req.user;

    try {
        const result = await db.query(
            `SELECT q.id, q.quote_ref, c.name as client_name, c.email as client_email, q.created_at, q.document_type, q.total_ttc
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             WHERE q.company_id = $1
             ORDER BY q.created_at DESC`,
            [companyId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ message: 'Error fetching quotes', error: error.message });
    }
});

// DELETE a quote by ID
app.delete('/api/quotes/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
    const dbClient = await db.pool.connect();

    try {
        await dbClient.query('BEGIN');

        // First, verify the quote belongs to the user's company
        const quoteResult = await dbClient.query(
            'SELECT id FROM quotes WHERE id = $1 AND company_id = $2', 
            [id, companyId]
        );
        
        if (quoteResult.rows.length === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ 
                message: 'Quote not found or you do not have permission to delete it.' 
            });
        }

        // Delete associated quote items first to respect foreign key constraints
        await dbClient.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

        // Then delete the quote itself
        await dbClient.query('DELETE FROM quotes WHERE id = $1', [id]);

        await dbClient.query('COMMIT');
        res.status(204).send(); // 204 No Content is appropriate for a successful deletion
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error deleting quote:', error); 
        res.status(500).json({ message: 'Failed to delete quote' });
    } finally {
        dbClient.release();
    }
});

// --- SERVER START ---

app.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}`);
});
