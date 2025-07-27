// Global variables for filtering
let allDashboardQuotes = [];
let filteredDashboardQuotes = [];

// Custom Notification System
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', title = null, duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
            error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
            warning: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
            info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${icons[type]}</div>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>
            <div class="notification-progress"></div>
        `;
        
        this.container.appendChild(notification);
        
        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.add('notification-hide');
            setTimeout(() => notification.remove(), 300);
        });
        
        // Auto dismiss with progress bar
        if (duration > 0) {
            const progressBar = notification.querySelector('.notification-progress');
            progressBar.style.animationDuration = `${duration}ms`;
            
            setTimeout(() => {
                notification.classList.add('notification-hide');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        return notification;
    }

    // Custom confirmation dialog
    confirm(message, title = 'Confirmer l\'action', confirmText = 'OK', cancelText = 'Annuler') {
        return new Promise((resolve) => {
            const confirmDialog = document.createElement('div');
            confirmDialog.className = 'confirmation-dialog-overlay';
            
            confirmDialog.innerHTML = `
                <div class="confirmation-dialog">
                    <div class="confirmation-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="confirmation-body">
                        <p>${message}</p>
                    </div>
                    <div class="confirmation-actions">
                        <button class="btn btn-secondary confirm-cancel">${cancelText}</button>
                        <button class="btn btn-primary confirm-ok">${confirmText}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmDialog);
            
            const handleConfirm = (result) => {
                confirmDialog.classList.add('confirmation-hide');
                setTimeout(() => {
                    confirmDialog.remove();
                    resolve(result);
                }, 200);
            };
            
            confirmDialog.querySelector('.confirm-ok').addEventListener('click', () => handleConfirm(true));
            confirmDialog.querySelector('.confirm-cancel').addEventListener('click', () => handleConfirm(false));
            
            // Close on overlay click
            confirmDialog.addEventListener('click', (e) => {
                if (e.target === confirmDialog) {
                    handleConfirm(false);
                }
            });
            
            // Close on Escape key
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeydown);
                    handleConfirm(false);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }

    success(message, title = 'Succès') {
        return this.show(message, 'success', title);
    }

    error(message, title = 'Erreur') {
        return this.show(message, 'error', title);
    }

    warning(message, title = 'Attention') {
        return this.show(message, 'warning', title);
    }

    info(message, title = 'Information') {
        return this.show(message, 'info', title);
    }
}

// Initialize notification system
const notify = new NotificationSystem();

async function loadQuotes(token) {
    try {
        const response = await fetch('/api/quotes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Échec du chargement des devis');

        allDashboardQuotes = await response.json();
        filteredDashboardQuotes = [...allDashboardQuotes];
        renderDashboardQuotes(filteredDashboardQuotes);
        
        // Initialize filters after loading data
        initializeDashboardFilters();
    } catch (error) {
        console.error('Error loading quotes:', error);
        notify.error('Impossible de charger les devis. Veuillez réessayer.', 'Erreur de chargement');
    }
}

// Function to render dashboard quotes table
function renderDashboardQuotes(quotes) {
    const tbody = document.getElementById('quotes-tbody');
    tbody.innerHTML = ''; 

    quotes.forEach(quote => {
        const row = tbody.insertRow();
        const formattedDate = new Date(quote.created_at).toLocaleDateString('fr-FR');
        const total = parseFloat(quote.total_ttc || 0).toFixed(2);
        const typeLabel = quote.document_type === 'invoice' ? 'Facture' : 'Devis';
        const typeBadge = quote.document_type === 'invoice' ? 'badge-success' : 'badge-primary';
        
        row.innerHTML = `
            <td>${quote.reference || quote.quote_ref || 'N/A'}</td>
            <td>${quote.client_name || 'N/A'}</td>
            <td>${formattedDate}</td>
            <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
            <td>${total}€</td>
            <td class="actions">
                <button onclick="editQuote(${quote.id})" class="btn btn-sm" title="Modifier">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L10.5 8.207l-3-3L12.146.146zM11.207 9l-3-3L2.5 11.707V13.5a.5.5 0 0 0 .5.5h1.793L11.207 9z"/>
                    </svg>
                    Modifier
                </button>
                <button onclick="previewQuote(${quote.id})" class="btn btn-sm btn-secondary" title="Aperçu">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                        <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                    </svg>
                    Aperçu
                </button>
                <button onclick="emailQuote(${quote.id}, '${quote.client_email}')" class="btn btn-sm btn-secondary" title="E-mail">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
                    </svg>
                    E-mail
                </button>
                <button onclick="deleteQuote(${quote.id})" class="btn btn-sm btn-danger" title="Supprimer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                    Supprimer
                </button>
            </td>
        `;
    });
}

// Initialize dashboard filters
function initializeDashboardFilters() {
    const dashboardQuotesSearch = document.getElementById('dashboard-quotes-search');
    const dashboardQuotesTypeFilter = document.getElementById('dashboard-quotes-type-filter');
    const dashboardQuotesSort = document.getElementById('dashboard-quotes-sort');
    const clearDashboardQuotesFilters = document.getElementById('clear-dashboard-quotes-filters');

    // Search functionality
    if (dashboardQuotesSearch) {
        dashboardQuotesSearch.addEventListener('input', applyDashboardQuotesFilters);
    }
    
    // Type filter
    if (dashboardQuotesTypeFilter) {
        dashboardQuotesTypeFilter.addEventListener('change', applyDashboardQuotesFilters);
    }
    
    // Sort functionality
    if (dashboardQuotesSort) {
        dashboardQuotesSort.addEventListener('change', applyDashboardQuotesFilters);
    }
    
    // Clear filters
    if (clearDashboardQuotesFilters) {
        clearDashboardQuotesFilters.addEventListener('click', () => {
            if (dashboardQuotesSearch) dashboardQuotesSearch.value = '';
            if (dashboardQuotesTypeFilter) dashboardQuotesTypeFilter.value = 'all';
            if (dashboardQuotesSort) dashboardQuotesSort.value = 'date-desc';
            
            filteredDashboardQuotes = [...allDashboardQuotes];
            applyDashboardQuotesSorting();
            renderDashboardQuotes(filteredDashboardQuotes);
        });
    }
}

// Apply dashboard quotes filters
function applyDashboardQuotesFilters() {
    let filtered = [...allDashboardQuotes];
    
    // Search filter
    const searchTerm = document.getElementById('dashboard-quotes-search')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(quote => 
            (quote.reference || quote.quote_ref || '').toLowerCase().includes(searchTerm) ||
            (quote.client_name || '').toLowerCase().includes(searchTerm) ||
            (quote.document_type || '').toLowerCase().includes(searchTerm)
        );
    }
    
    // Type filter
    const typeFilter = document.getElementById('dashboard-quotes-type-filter')?.value || 'all';
    if (typeFilter !== 'all') {
        filtered = filtered.filter(quote => quote.document_type === typeFilter);
    }
    
    filteredDashboardQuotes = filtered;
    applyDashboardQuotesSorting();
    renderDashboardQuotes(filteredDashboardQuotes);
}

// Apply dashboard quotes sorting
function applyDashboardQuotesSorting() {
    const sortValue = document.getElementById('dashboard-quotes-sort')?.value || 'date-desc';
    const [field, direction] = sortValue.split('-');
    
    filteredDashboardQuotes.sort((a, b) => {
        let aVal, bVal;
        
        switch (field) {
            case 'date':
                aVal = new Date(a.created_at);
                bVal = new Date(b.created_at);
                break;
            case 'client':
                aVal = (a.client_name || '').toLowerCase();
                bVal = (b.client_name || '').toLowerCase();
                break;
            case 'total':
                aVal = parseFloat(a.total_ttc || 0);
                bVal = parseFloat(b.total_ttc || 0);
                break;
            default:
                aVal = a[field] || '';
                bVal = b[field] || '';
        }
        
        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

async function deleteQuote(quoteId) {
    const token = localStorage.getItem('token');
    const confirmed = await notify.confirm(
        'Êtes-vous sûr de vouloir supprimer ce devis ? Cette action ne peut pas être annulée.',
        'Supprimer le devis',
        'Supprimer',
        'Annuler'
    );
    
    if (confirmed) {
        try {
            const response = await fetch(`/api/quotes/${quoteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                // Remove from data arrays and refresh display
                allDashboardQuotes = allDashboardQuotes.filter(quote => quote.id !== quoteId);
                filteredDashboardQuotes = filteredDashboardQuotes.filter(quote => quote.id !== quoteId);
                renderDashboardQuotes(filteredDashboardQuotes);
                notify.success('Devis supprimé avec succès !', 'Supprimé');
            } else {
                const err = await response.json();
                throw new Error(err.message || 'Échec de la suppression du devis');
            }
        } catch (error) {
            console.error('Error deleting quote:', error);
            notify.error(`Erreur : ${error.message}`, 'Échec de la suppression');
        }
    }
}

// Function to edit a quote - redirects to clients.html with edit mode
function editQuote(quoteId) {
    // Redirect to clients.html with the quote ID for editing
    window.location.href = `/clients.html?edit-quote=${quoteId}`;
}

// Function to send quote via email
async function emailQuote(quoteId, clientEmail) {
    const token = localStorage.getItem('token');
    const confirmed = await notify.confirm(
        `Êtes-vous sûr de vouloir envoyer ce devis par e-mail à ${clientEmail} ?`,
        'Envoyer par e-mail',
        'Envoyer',
        'Annuler'
    );
    
    if (confirmed) {
        try {
            const response = await fetch(`/api/quotes/${quoteId}/send`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                notify.success('E-mail envoyé avec succès !', 'E-mail envoyé');
            } else {
                const err = await response.json();
                throw new Error(err.message || 'Échec de l\'envoi de l\'e-mail');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            notify.error(`Erreur : ${error.message}`, 'Échec de l\'envoi');
        }
    }
}

// Function to preview a quote
async function previewQuote(quoteId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/quotes/${quoteId}/preview`, { 
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Échec de la génération de l\'aperçu');
        }

        const data = await response.json();
        
        // Create a blob URL for the PDF and open it directly
        const pdfBlob = new Blob([Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Open PDF directly in a new window
        const pdfWindow = window.open(pdfUrl, '_blank');
        
        // Clean up the blob URL after a short delay
        setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
        }, 1000);

    } catch (error) {
        console.error('Error generating preview:', error);
        notify.error('Échec de la génération de l\'aperçu. Veuillez réessayer.', 'Erreur d\'aperçu');
    }
}

async function downloadQuote(quoteId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/quotes/${quoteId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Échec du téléchargement du devis');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'download.pdf';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?(.+)"?/);
            if (match.length > 1) {
                fileName = match[1];
            }
        }
        a.download = fileName;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error('Error downloading quote:', error);
        notify.error('Impossible de télécharger le devis. Veuillez réessayer.', 'Erreur de téléchargement');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const decodedToken = JSON.parse(atob(token.split('.')[1]));
    const userRole = decodedToken.role;
    document.getElementById('user-role').textContent = userRole;

    if (userRole === 'super-admin') {
        document.getElementById('super-admin-section').style.display = 'block';
        loadCompanies(token);
        setupCompanyCreationForm(token);
    }

    // Admins and Super Admins should see the quotes and client management
    if (userRole === 'admin' || userRole === 'super-admin') {
        document.getElementById('admin-section').style.display = 'block';
        loadQuotes(token);
    }

    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });
});

async function loadCompanies(token) {
    try {
        const response = await fetch('/api/companies', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Échec du chargement des entreprises');
        }

        const companies = await response.json();
        const companiesList = document.getElementById('companies-list');
        companiesList.innerHTML = '';
        
        companies.forEach(company => {
            const li = document.createElement('li');
            li.className = 'company-item';
            li.innerHTML = `
                <div class="company-info">
                    <div class="company-main">
                        <strong>${company.name}</strong>
                        <span class="company-email">${company.email}</span>
                    </div>
                    <div class="company-details">
                        <span>📞 ${company.phone || 'N/A'}</span>
                        <span>🌐 ${company.website || 'N/A'}</span>
                        <span>📍 ${company.address || 'N/A'}</span>
                    </div>
                    <div class="company-theme">
                        <span class="theme-color" style="background-color: ${company.theme_primary_color || '#2563eb'}" title="Couleur primaire"></span>
                        <span class="theme-color" style="background-color: ${company.theme_secondary_color || '#64748b'}" title="Couleur secondaire"></span>
                        <span class="theme-color" style="background-color: ${company.theme_accent_color || '#059669'}" title="Couleur d'accent"></span>
                        <span class="theme-color" style="background-color: ${company.theme_text_color || '#1f2937'}" title="Couleur du texte"></span>
                    </div>
                </div>
                <div class="company-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editCompany(${company.id})" title="Modifier l'Entreprise">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L10.5 8.207l-3-3L12.146.146zM11.207 9l-3-3L2.5 11.707V14.5a.5.5 0 0 0 .5.5h2.793L11.207 9z"/>
                        </svg>
                        Modifier
                    </button>
                </div>
            `;
            companiesList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading companies:', error);
        notify.error('Impossible de charger les entreprises. Veuillez réessayer.', 'Erreur de chargement');
    }
}

function setupCompanyCreationForm(token) {
    const form = document.getElementById('create-company-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const formData = new FormData();
        formData.append('name', document.getElementById('company-name').value);
        formData.append('phone', document.getElementById('company-phone').value);
        formData.append('email', document.getElementById('company-email').value);
        formData.append('website', document.getElementById('company-website').value);
        formData.append('address', document.getElementById('company-address').value);
        formData.append('siret', document.getElementById('company-siret').value);
        
        // Add theme colors
        formData.append('theme_primary_color', document.getElementById('theme-primary-color').value);
        formData.append('theme_secondary_color', document.getElementById('theme-secondary-color').value);
        formData.append('theme_accent_color', document.getElementById('theme-accent-color').value);
        formData.append('theme_text_color', document.getElementById('theme-text-color').value);
        
        const logoInput = document.getElementById('company-logo');
        if (logoInput.files[0]) {
            formData.append('logo', logoInput.files[0]);
        }

        // Check if we're editing (company ID exists)
        const companyIdInput = document.getElementById('company-id-input');
        const isEditing = companyIdInput && companyIdInput.value;
        
        try {
            const url = isEditing ? `/api/companies/${companyIdInput.value}` : '/api/companies';
            const method = isEditing ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Échec de ${isEditing ? 'mise à jour' : 'création'} de l'entreprise`);
            }

            notify.success(`Entreprise ${isEditing ? 'mise à jour' : 'créée'} avec succès !`, isEditing ? 'Entreprise mise à jour' : 'Entreprise créée');
            resetCompanyForm(); // Reset form to create mode
            loadCompanies(token); // Reload the list

        } catch (error) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} company:`, error);
            notify.error(`Erreur : ${error.message}`, isEditing ? 'Échec de la mise à jour' : 'Échec de la création');
        }
    });
}

function addCompanyToList(company) {
    const companiesList = document.getElementById('companies-list');
    const li = document.createElement('li');
    
    let logoImg = '';
    if (company.logo_path) {
        logoImg = `<img src="${company.logo_path}" alt="Logo de ${company.name}" class="company-logo-sm">`;
    }
    
    li.innerHTML = `
        <div class="company-list-item">
            ${logoImg}
            <span>${company.name} (${company.email})</span>
        </div>
    `;
    companiesList.appendChild(li);
}

// Edit company function
function editCompany(companyId) {
    // Get company data and populate edit form
    const token = localStorage.getItem('token');
    
    fetch(`/api/companies/${companyId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Échec du chargement des données de l\'entreprise');
        }
        return response.json();
    })
    .then(company => {
        // Populate the form with existing data
        document.getElementById('company-name').value = company.name || '';
        document.getElementById('company-phone').value = company.phone || '';
        document.getElementById('company-email').value = company.email || '';
        document.getElementById('company-website').value = company.website || '';
        document.getElementById('company-address').value = company.address || '';
        document.getElementById('company-siret').value = company.siret || '';
        
        // Populate theme colors
        document.getElementById('theme-primary-color').value = company.theme_primary_color || '#2563eb';
        document.getElementById('theme-secondary-color').value = company.theme_secondary_color || '#64748b';
        document.getElementById('theme-accent-color').value = company.theme_accent_color || '#059669';
        document.getElementById('theme-text-color').value = company.theme_text_color || '#1f2937';
        
        // Change form title and button text
        document.querySelector('#create-company-form h3').textContent = 'Modifier l\'Entreprise';
        document.querySelector('#create-company-form button[type="submit"]').textContent = 'Mettre à Jour l\'Entreprise';
        
        // Show cancel button
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';
        
        // Add hidden input for company ID
        let companyIdInput = document.getElementById('company-id-input');
        if (!companyIdInput) {
            companyIdInput = document.createElement('input');
            companyIdInput.type = 'hidden';
            companyIdInput.id = 'company-id-input';
            companyIdInput.name = 'company_id';
            document.getElementById('create-company-form').prepend(companyIdInput);
        }
        companyIdInput.value = companyId;
        
        // Scroll to form
        document.getElementById('create-company-form').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(error => {
        console.error('Error fetching company data:', error);
        notify.error('Échec du chargement des données de l\'entreprise pour modification. Veuillez réessayer.', 'Erreur de chargement');
    });
}

// Reset company form to create mode
function resetCompanyForm() {
    document.querySelector('#create-company-form h3').textContent = 'Créer une Nouvelle Entreprise';
    document.querySelector('#create-company-form button[type="submit"]').textContent = 'Créer l\'Entreprise';
    
    // Hide cancel button
    document.getElementById('cancel-edit-btn').style.display = 'none';
    
    const companyIdInput = document.getElementById('company-id-input');
    if (companyIdInput) {
        companyIdInput.remove();
    }
    
    // Reset form
    document.getElementById('create-company-form').reset();
    
    // Reset theme colors to defaults
    document.getElementById('theme-primary-color').value = '#2563eb';
    document.getElementById('theme-secondary-color').value = '#64748b';
    document.getElementById('theme-accent-color').value = '#059669';
    document.getElementById('theme-text-color').value = '#1f2937';
}