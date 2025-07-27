document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    // Decode token to check role
    let userPayload;
    try {
        userPayload = JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        console.error('Invalid token:', e);
        localStorage.removeItem('token');
        window.location.href = '/index.html';
        return;
    }

    if (userPayload.role === 'super-admin') {
        notify.warning('Les super-administrateurs ne peuvent pas gérer directement les clients. Veuillez d\'abord créer une entreprise et un utilisateur administrateur.', 'Accès Restreint');
        setTimeout(() => {
            window.location.href = '/users.html';
        }, 2000);
        return;
    }

    const headers = { 'Authorization': `Bearer ${token}` };

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
        confirm(message, title = 'Confirmer l\'Action', confirmText = 'OK', cancelText = 'Annuler') {
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

        warning(message, title = 'Avertissement') {
            return this.show(message, 'warning', title);
        }

        info(message, title = 'Information') {
            return this.show(message, 'info', title);
        }
    }

    // Initialize notification system
    const notify = new NotificationSystem();

    // --- ELEMENT SELECTORS ---
    const clientsTbody = document.getElementById('clients-tbody');
    const quoteClientSelect = document.getElementById('quote-client');
    const modal = document.getElementById('client-form-modal');
    const addClientBtn = document.getElementById('add-client-btn');
    const closeModalBtn = document.querySelector('.close-button');
    const cancelFormBtn = document.getElementById('cancel-client-form');
    const clientForm = document.getElementById('client-form');
    const clientFormTitle = document.getElementById('client-form-title');
    const clientIdInput = document.getElementById('client-id');
    const quoteForm = document.getElementById('quote-form');
    const quoteItemsContainer = document.getElementById('quote-items-container');
    const addItemBtn = document.getElementById('add-item-btn');
    const quotesTbody = document.getElementById('quotes-tbody');

    // --- SEARCH, FILTER & SORT FUNCTIONALITY ---
    let allClients = [];
    let allQuotes = [];
    let filteredClients = [];
    let filteredQuotes = [];

    // --- CLIENT MANAGEMENT ---
    const fetchClients = async () => {
        try {
            const response = await fetch('/api/clients', { headers });
            if (!response.ok) throw new Error('Échec de la récupération des clients');
            allClients = await response.json();
            filteredClients = [...allClients];
            renderClients(filteredClients);
            initializeClientFilters();
        } catch (error) {
            console.error('Erreur lors de la récupération des clients:', error);
        }
    };

    // Function to render clients table
    const renderClients = (clients) => {
        if (!clientsTbody) return;
        
        clientsTbody.innerHTML = '';
        if (quoteClientSelect) {
            quoteClientSelect.innerHTML = '<option value="">Sélectionner un client</option>';
        }

        clients.forEach(client => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${client.name}</td>
                <td>${client.address}</td>
                <td>${client.phone}</td>
                <td>${client.email}</td>
                <td class="actions">
                    <button class="btn btn-sm" data-action="edit" data-id="${client.id}">Modifier</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${client.id}">Supprimer</button>
                </td>
            `;
            clientsTbody.appendChild(tr);

            if (quoteClientSelect) {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                quoteClientSelect.appendChild(option);
            }
        });
    };

    // --- QUOTES MANAGEMENT ---
    const fetchQuotes = async () => {
        try {
            const response = await fetch('/api/quotes', { headers });
            if (!response.ok) throw new Error('Échec de la récupération des devis');
            allQuotes = await response.json();
            filteredQuotes = [...allQuotes];
            renderQuotes(filteredQuotes);
            initializeQuotesFilters();
        } catch (error) {
            console.error('Erreur lors de la récupération des devis:', error);
        }
    };

    // Function to render quotes table
    const renderQuotes = (quotes) => {
        if (!quotesTbody) return;
        
        quotesTbody.innerHTML = '';
        quotes.forEach(quote => {
            const tr = document.createElement('tr');
            const formattedDate = new Date(quote.created_at).toLocaleDateString('fr-FR');
            const total = parseFloat(quote.total_ttc || 0).toFixed(2);
            
            tr.innerHTML = `
                <td>${quote.quote_ref || quote.reference || 'N/A'}</td>
                <td>${quote.client_name || 'N/A'}</td>
                <td>${formattedDate}</td>
                <td><span class="badge ${quote.document_type === 'invoice' ? 'badge-success' : 'badge-primary'}">${quote.document_type === 'invoice' ? 'Facture' : 'Devis'}</span></td>
                <td>${total}€</td>
                <td class="actions">
                    <button class="btn btn-sm" data-action="edit" data-id="${quote.id}">Modifier</button>
                    <button class="btn btn-sm btn-secondary" data-action="email" data-id="${quote.id}" data-client-email="${quote.client_email}">E-mail</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${quote.id}">Supprimer</button>
                    <button class="btn btn-sm btn-success" data-action="preview" data-id="${quote.id}">Aperçu</button>
                </td>
            `;
            quotesTbody.appendChild(tr);
        });
    };

    // Handle quotes table actions
    if (quotesTbody) {
        quotesTbody.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;
            const clientEmail = button.dataset.clientEmail;

            if (action === 'edit') {
                // Open quote edit modal or redirect to edit page
                window.location.href = `/clients.html?edit-quote=${id}`;
            } else if (action === 'preview') {
                // Open PDF preview in new tab with authentication (matching dashboard.js working implementation)
                try {
                    const response = await fetch(`/api/quotes/${id}/preview`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Échec de la génération de l\'aperçu');
                    }

                    const data = await response.json();
                    
                    // Create a blob URL for the PDF and open it directly (same as dashboard.js)
                    const pdfBlob = new Blob([Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    
                    // Open PDF directly in a new window
                    const pdfWindow = window.open(pdfUrl, '_blank');
                    
                    // Clean up the blob URL after a short delay
                    setTimeout(() => {
                        URL.revokeObjectURL(pdfUrl);
                    }, 1000);

                } catch (error) {
                    console.error('Erreur lors de la génération de l\'aperçu:', error);
                    alert('Échec de la génération de l\'aperçu. Veuillez réessayer.');
                }
            } else if (action === 'email') {
                // Send quote via email
                const confirmed = await notify.confirm(`Envoyer le devis à ${clientEmail}?`, 'Envoyer l\'E-mail', 'Envoyer', 'Annuler');
                if (confirmed) {
                    try {
                        const response = await fetch(`/api/quotes/${id}/email`, {
                            method: 'POST',
                            headers
                        });

                        if (response.ok) {
                            notify.success('Devis envoyé avec succès!', 'E-mail Envoyé');
                        } else {
                            throw new Error('Échec de l\'envoi du devis');
                        }
                    } catch (error) {
                        console.error('Erreur lors de l\'envoi du devis:', error);
                        notify.error('Erreur lors de l\'envoi du devis', 'Échec de l\'E-mail');
                    }
                }
            } else if (action === 'delete') {
                // Delete quote
                const confirmed = await notify.confirm('Êtes-vous sûr de vouloir supprimer ce devis?', 'Supprimer le Devis', 'Supprimer', 'Annuler');
                if (confirmed) {
                    try {
                        const response = await fetch(`/api/quotes/${id}`, {
                            method: 'DELETE',
                            headers
                        });

                        if (response.ok) {
                            allQuotes = allQuotes.filter(quote => quote.id != id);
                            filteredQuotes = filteredQuotes.filter(quote => quote.id != id);
                            renderQuotes(filteredQuotes);
                            notify.success('Devis supprimé avec succès!', 'Supprimé');
                        } else {
                            throw new Error('Échec de la suppression du devis');
                        }
                    } catch (error) {
                        console.error('Erreur lors de la suppression du devis:', error);
                        notify.error('Erreur lors de la suppression du devis', 'Échec de la Suppression');
                    }
                }
            }
        });
    }

    // --- QUOTE ITEM MANAGEMENT ---
    let itemCounter = 0;

    const addQuoteItem = () => {
        if (!quoteItemsContainer) return;
        
        itemCounter++;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'quote-item';
        itemDiv.dataset.itemId = itemCounter;
        
        itemDiv.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label for="description-${itemCounter}">Description</label>
                    <textarea id="description-${itemCounter}" name="description-${itemCounter}" rows="2" required></textarea>
                </div>
                <div class="form-group">
                    <label for="quantity-${itemCounter}">Quantité</label>
                    <input type="number" id="quantity-${itemCounter}" name="quantity-${itemCounter}" step="0.01" min="0" value="1" required>
                </div>
                <div class="form-group">
                    <label for="unit-price-${itemCounter}">Prix Unitaire (€)</label>
                    <input type="number" id="unit-price-${itemCounter}" name="unit-price-${itemCounter}" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label for="vat-rate-${itemCounter}">TVA (%)</label>
                    <select id="vat-rate-${itemCounter}" name="vat-rate-${itemCounter}" required>
                        <option value="0">0%</option>
                        <option value="5.5">5.5%</option>
                        <option value="10">10%</option>
                        <option value="20" selected>20%</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Total HT</label>
                    <input type="text" class="item-total-ht" readonly>
                </div>
                <div class="form-group">
                    <button type="button" class="btn btn-sm btn-danger remove-item-btn" data-item-id="${itemCounter}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                        </svg>
                        Supprimer
                    </button>
                </div>
            </div>
        `;
        
        quoteItemsContainer.appendChild(itemDiv);
        
        // Add event listeners for calculations
        const quantityInput = itemDiv.querySelector(`#quantity-${itemCounter}`);
        const priceInput = itemDiv.querySelector(`#unit-price-${itemCounter}`);
        const vatSelect = itemDiv.querySelector(`#vat-rate-${itemCounter}`);
        const totalInput = itemDiv.querySelector('.item-total-ht');
        
        const calculateItemTotal = () => {
            const quantity = parseFloat(quantityInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const total = quantity * price;
            totalInput.value = `${total.toFixed(2)}€`;
            calculateQuoteTotal();
        };
        
        quantityInput.addEventListener('input', calculateItemTotal);
        priceInput.addEventListener('input', calculateItemTotal);
        vatSelect.addEventListener('change', calculateItemTotal);
        
        // Remove item functionality
        const removeBtn = itemDiv.querySelector('.remove-item-btn');
        removeBtn.addEventListener('click', () => {
            itemDiv.remove();
            calculateQuoteTotal();
        });
    };

    const calculateQuoteTotal = () => {
        const items = document.querySelectorAll('.quote-item');
        let totalHT = 0;
        let totalTVA = 0;
        
        items.forEach(item => {
            const quantity = parseFloat(item.querySelector('[name^="quantity-"]').value) || 0;
            const price = parseFloat(item.querySelector('[name^="unit-price-"]').value) || 0;
            const vatRate = parseFloat(item.querySelector('[name^="vat-rate-"]').value) || 0;
            
            const itemTotal = quantity * price;
            const itemVAT = itemTotal * (vatRate / 100);
            
            totalHT += itemTotal;
            totalTVA += itemVAT;
        });
        
        const totalTTC = totalHT + totalTVA;
        
        // Update total displays if they exist
        const totalHTDisplay = document.getElementById('total-ht');
        const totalTVADisplay = document.getElementById('total-tva');
        const totalTTCDisplay = document.getElementById('total-ttc');
        
        if (totalHTDisplay) totalHTDisplay.textContent = `${totalHT.toFixed(2)}€`;
        if (totalTVADisplay) totalTVADisplay.textContent = `${totalTVA.toFixed(2)}€`;
        if (totalTTCDisplay) totalTTCDisplay.textContent = `${totalTTC.toFixed(2)}€`;
    };

    // --- AIDE MANAGEMENT ---
    let aideCounter = 0;
    const aidesContainer = document.getElementById('aides-container');
    const addAideBtn = document.getElementById('add-aide-btn');

    const addAide = () => {
        if (!aidesContainer) return;
        
        aideCounter++;
        const aideDiv = document.createElement('div');
        aideDiv.className = 'aide-item';
        aideDiv.dataset.aideId = aideCounter;
        
        aideDiv.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label for="aide-name-${aideCounter}">Nom de l'aide</label>
                    <input type="text" id="aide-name-${aideCounter}" name="aide-name-${aideCounter}" required>
                </div>
                <div class="form-group">
                    <label for="aide-amount-${aideCounter}">Montant (€)</label>
                    <input type="number" id="aide-amount-${aideCounter}" name="aide-amount-${aideCounter}" step="0.01" required>
                </div>
                <div class="form-group">
                    <button type="button" class="btn btn-sm btn-danger remove-aide-btn" data-aide-id="${aideCounter}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                        </svg>
                        Supprimer
                    </button>
                </div>
            </div>
        `;
        
        aidesContainer.appendChild(aideDiv);
        
        // Remove aide functionality
        const removeBtn = aideDiv.querySelector('.remove-aide-btn');
        removeBtn.addEventListener('click', () => {
            aideDiv.remove();
        });
    };

    // Initialize client filters
    function initializeClientFilters() {
        const clientsSearch = document.getElementById('clients-search');
        const clientsSort = document.getElementById('clients-sort');
        const clearClientsFilters = document.getElementById('clear-clients-filters');

        if (clientsSearch) {
            clientsSearch.addEventListener('input', applyClientFilters);
        }
        
        if (clientsSort) {
            clientsSort.addEventListener('change', applyClientFilters);
        }
        
        if (clearClientsFilters) {
            clearClientsFilters.addEventListener('click', () => {
                if (clientsSearch) clientsSearch.value = '';
                if (clientsSort) clientsSort.value = 'name-asc';
                filteredClients = [...allClients];
                applyClientSorting();
                renderClients(filteredClients);
            });
        }
    }

    // Apply client filters
    function applyClientFilters() {
        let filtered = [...allClients];
        
        // Search filter
        const searchTerm = document.getElementById('clients-search')?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(client => 
                (client.name || '').toLowerCase().includes(searchTerm) ||
                (client.email || '').toLowerCase().includes(searchTerm) ||
                (client.address || '').toLowerCase().includes(searchTerm) ||
                (client.phone || '').toLowerCase().includes(searchTerm)
            );
        }
        
        filteredClients = filtered;
        applyClientSorting();
        renderClients(filteredClients);
    }

    // Apply client sorting
    function applyClientSorting() {
        const sortValue = document.getElementById('clients-sort')?.value || 'name-asc';
        const [field, direction] = sortValue.split('-');
        
        filteredClients.sort((a, b) => {
            let aVal = (a[field] || '').toLowerCase();
            let bVal = (b[field] || '').toLowerCase();
            
            if (direction === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    // Initialize quotes filters
    function initializeQuotesFilters() {
        const quotesSearch = document.getElementById('quotes-search');
        const quotesTypeFilter = document.getElementById('quotes-type-filter');
        const quotesSort = document.getElementById('quotes-sort');
        const clearQuotesFilters = document.getElementById('clear-quotes-filters');

        if (quotesSearch) {
            quotesSearch.addEventListener('input', applyQuotesFilters);
        }
        
        if (quotesTypeFilter) {
            quotesTypeFilter.addEventListener('change', applyQuotesFilters);
        }
        
        if (quotesSort) {
            quotesSort.addEventListener('change', applyQuotesFilters);
        }
        
        if (clearQuotesFilters) {
            clearQuotesFilters.addEventListener('click', () => {
                if (quotesSearch) quotesSearch.value = '';
                if (quotesTypeFilter) quotesTypeFilter.value = 'all';
                if (quotesSort) quotesSort.value = 'date-desc';
                
                filteredQuotes = [...allQuotes];
                applyQuotesSorting();
                renderQuotes(filteredQuotes);
            });
        }
    }

    // Apply quotes filters
    function applyQuotesFilters() {
        let filtered = [...allQuotes];
        
        // Search filter
        const searchTerm = document.getElementById('quotes-search')?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(quote => 
                (quote.reference || quote.quote_ref || '').toLowerCase().includes(searchTerm) ||
                (quote.client_name || '').toLowerCase().includes(searchTerm) ||
                (quote.document_type || '').toLowerCase().includes(searchTerm)
            );
        }
        
        // Type filter
        const typeFilter = document.getElementById('quotes-type-filter')?.value || 'all';
        if (typeFilter !== 'all') {
            filtered = filtered.filter(quote => quote.document_type === typeFilter);
        }
        
        filteredQuotes = filtered;
        applyQuotesSorting();
        renderQuotes(filteredQuotes);
    }

    // Apply quotes sorting
    function applyQuotesSorting() {
        const sortValue = document.getElementById('quotes-sort')?.value || 'date-desc';
        const [field, direction] = sortValue.split('-');
        
        filteredQuotes.sort((a, b) => {
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

    // Event listeners
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            clientForm.reset();
            clientIdInput.value = '';
            clientFormTitle.textContent = 'Ajouter un Nouveau Client';
            modal.style.display = 'block';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            clientForm.reset();
        });
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            clientForm.reset();
        });
    }

    // Add item button functionality
    if (addItemBtn) {
        addItemBtn.addEventListener('click', addQuoteItem);
    }

    // Add aide button functionality
    if (addAideBtn) {
        addAideBtn.addEventListener('click', addAide);
    }

    // Client form submission
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(clientForm);
            const clientData = Object.fromEntries(formData);
            const clientId = clientIdInput.value;

            try {
                const url = clientId ? `/api/clients/${clientId}` : '/api/clients';
                const method = clientId ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(clientData)
                });

                if (response.ok) {
                    modal.style.display = 'none';
                    clientForm.reset();
                    await fetchClients(); // Refresh the list
                } else {
                    throw new Error('Échec de la sauvegarde du client');
                }
            } catch (error) {
                console.error('Erreur lors de la sauvegarde du client:', error);
                notify.error('Erreur lors de la sauvegarde du client', 'Échec de la Sauvegarde');
            }
        });
    }

    // Handle clients table actions
    if (clientsTbody) {
        clientsTbody.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === 'edit') {
                try {
                    const response = await fetch(`/api/clients`, { headers });
                    const clients = await response.json();
                    const client = clients.find(c => c.id == id);

                    if (client) {
                        clientIdInput.value = client.id;
                        clientFormTitle.textContent = 'Modifier le Client';
                        document.getElementById('name').value = client.name;
                        document.getElementById('title').value = client.title || '';
                        document.getElementById('address').value = client.address;
                        document.getElementById('phone').value = client.phone;
                        document.getElementById('email').value = client.email;
                        modal.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Erreur lors de la récupération du client pour modification:', error);
                }
            } else if (action === 'delete') {
                const confirmed = await notify.confirm('Êtes-vous sûr de vouloir supprimer ce client?', 'Supprimer le Client', 'Supprimer', 'Annuler');
                if (confirmed) {
                    try {
                        const response = await fetch(`/api/clients/${id}`, {
                            method: 'DELETE',
                            headers
                        });

                        if (response.ok) {
                            allClients = allClients.filter(client => client.id != id);
                            filteredClients = filteredClients.filter(client => client.id != id);
                            renderClients(filteredClients);
                            notify.success('Client supprimé avec succès!', 'Supprimé');
                        } else {
                            throw new Error('Échec de la suppression du client');
                        }
                    } catch (error) {
                        console.error('Erreur lors de la suppression du client:', error);
                        notify.error('Erreur lors de la suppression du client', 'Échec de la Suppression');
                    }
                }
            }
        });
    }

    // Quote form submission
    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(quoteForm);
            const quoteData = Object.fromEntries(formData);
            
            // Collect quote items
            const items = [];
            const quoteItems = document.querySelectorAll('.quote-item');
            quoteItems.forEach((item, index) => {
                const description = item.querySelector(`[name^="description-"]`).value;
                const quantity = parseFloat(item.querySelector(`[name^="quantity-"]`).value) || 0;
                const unitPrice = parseFloat(item.querySelector(`[name^="unit-price-"]`).value) || 0;
                const vatRate = parseFloat(item.querySelector(`[name^="vat-rate-"]`).value) || 0;
                
                if (description && quantity > 0 && unitPrice > 0) {
                    items.push({
                        description,
                        quantity,
                        unit_price: unitPrice,
                        tva_rate: vatRate  // Changed from vat_rate to tva_rate to match server
                    });
                }
            });
            
            // Collect aides
            const aides = [];
            const aideItems = document.querySelectorAll('.aide-item');
            aideItems.forEach((item) => {
                const name = item.querySelector(`[name^="aide-name-"]`).value;
                const amount = parseFloat(item.querySelector(`[name^="aide-amount-"]`).value) || 0;
                
                if (name && amount > 0) {
                    aides.push({
                        name,
                        amount
                    });
                }
            });
            
            if (items.length === 0) {
                notify.warning('Veuillez ajouter au moins un élément de devis.', 'Éléments Manquants');
                return;
            }
            
            // Fix field name mapping for server compatibility
            const payload = {
                ...quoteData,
                document_type: quoteData['quote-type'], // Map quote-type to document_type
                items,
                aides
            };
            
            // Remove the old field name to avoid confusion
            delete payload['quote-type'];
            
            console.log('Payload being sent to server:', payload);
            
            // Detect if we're in edit mode
            const urlParams = new URLSearchParams(window.location.search);
            const editQuoteId = urlParams.get('edit-quote');
            const isEditMode = !!editQuoteId;
            
            // Determine API endpoint and method
            const apiUrl = isEditMode ? `/api/quotes/${editQuoteId}` : '/api/quotes';
            const httpMethod = isEditMode ? 'PUT' : 'POST';
            
            console.log(`${isEditMode ? 'Mise à jour' : 'Création'} du devis en utilisant ${httpMethod} ${apiUrl}`);
            
            try {
                const response = await fetch(apiUrl, {
                    method: httpMethod,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // Show appropriate success message
                    const successMessage = isEditMode ? 'Devis mis à jour avec succès!' : 'Devis sauvegardé avec succès!';
                    notify.success(successMessage, 'Succès');
                    
                    // Clean up URL parameters if we were in edit mode
                    if (isEditMode) {
                        // Remove the edit-quote parameter from URL
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, document.title, newUrl);
                        console.log('URL nettoyée - mode édition supprimé');
                    }
                    
                    quoteForm.reset();
                    // Clear items and aides
                    document.getElementById('quote-items-container').innerHTML = '';
                    document.getElementById('aides-container').innerHTML = '';
                    // Add one default item
                    addQuoteItem();
                    // Refresh quotes list
                    await fetchQuotes();
                } else {
                    // Get the actual error message from server
                    const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
                    console.error('Réponse d\'erreur du serveur:', errorData);
                    throw new Error(`Erreur serveur: ${errorData.message || 'Échec de la sauvegarde du devis'}`);
                }
            } catch (error) {
                console.error('Erreur lors de la sauvegarde du devis:', error);
                notify.error(`Erreur lors de la sauvegarde du devis: ${error.message}`, 'Échec de la Sauvegarde');
            }
        });
    }

    // Logout functionality
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/index.html';
        });
    }

    // Function to load quote for editing
    const loadQuoteForEdit = async (quoteId) => {
        notify.info('Chargement du devis pour modification...', 'Mode Modification');
        console.log('Chargement du devis pour modification, ID:', quoteId);
        try {
            // Fetch complete quote data with items and aides using new endpoint
            console.log('Récupération des données du devis depuis:', `/api/quotes/${quoteId}`);
            const response = await fetch(`/api/quotes/${quoteId}`, { headers });
            console.log('Statut de la réponse:', response.status);
            console.log('Réponse OK:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Réponse d\'erreur du serveur:', errorText);
                if (response.status === 404) {
                    alert('Devis non trouvé');
                } else {
                    alert(`Échec de la récupération du devis: ${response.status} - ${errorText}`);
                    throw new Error('Échec de la récupération du devis');
                }
                // Remove edit parameter from URL
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
            
            const quote = await response.json();
            console.log('Données du devis reçues:', quote);
            console.log('Éléments du devis:', quote.items);
            console.log('Aides du devis:', quote.aides);
            
            // Debug form elements
            console.log('Élément de sélection client:', document.getElementById('quote-client'));
            console.log('Élément de sélection type:', document.getElementById('quote-type'));
            console.log('Conteneur des éléments:', document.getElementById('quote-items-container'));
            console.log('Conteneur des aides:', document.getElementById('aides-container'));
            
            // Update form title to indicate edit mode
            const formTitle = document.getElementById('quote-form-title');
            if (formTitle) {
                formTitle.textContent = `Modifier le Devis - ${quote.quote_ref || quote.reference || quote.id}`;
            }
            
            // Populate basic quote data
            const clientSelect = document.getElementById('quote-client');
            const typeSelect = document.getElementById('quote-type');
            
            console.log('Éléments du formulaire après délai:');
            console.log('Sélection client:', clientSelect);
            console.log('Sélection type:', typeSelect);
            
            if (clientSelect && quote.client_id) {
                console.log('Définition de la sélection client à:', quote.client_id);
                clientSelect.value = quote.client_id;
                console.log('Valeur de sélection client après définition:', clientSelect.value);
            } else {
                console.error('Sélection client non trouvée ou pas de client_id');
            }
            
            if (typeSelect && quote.document_type) {
                console.log('Définition du type de document à:', quote.document_type);
                typeSelect.value = quote.document_type;
                console.log('Valeur de sélection type après définition:', typeSelect.value);
            } else {
                console.error('Sélection type non trouvée ou pas de document_type');
            }
            
            // Populate footer fields if they exist
            const footerFields = [
                'down_payment_text', 'iban', 'installer_ref', 
                'capacity_attestation_no', 'civil_liability_insurance', 'footer_notes'
            ];
            
            footerFields.forEach(field => {
                const input = document.getElementById(field);
                if (input && quote[field]) {
                    input.value = quote[field];
                }
            });
            
            // Clear existing items and aides
            const itemsContainer = document.getElementById('quote-items-container');
            const aidesContainer = document.getElementById('aides-container');
            
            if (itemsContainer) itemsContainer.innerHTML = '';
            if (aidesContainer) aidesContainer.innerHTML = '';
            
            // Load quote items
            console.log('Chargement des éléments du devis...');
            console.log('Tableau des éléments du devis:', quote.items);
            console.log('Longueur du tableau des éléments:', quote.items ? quote.items.length : 'non défini');
            
            if (quote.items && quote.items.length > 0) {
                console.log('Trouvé', quote.items.length, 'éléments à charger');
                quote.items.forEach((item, index) => {
                    console.log(`Chargement de l'élément ${index + 1}:`, item);
                    addQuoteItem();
                    const itemElements = document.querySelectorAll('.quote-item');
                    const lastItem = itemElements[itemElements.length - 1];
                    
                    if (lastItem) {
                        const descInput = lastItem.querySelector('[name^="description-"]');
                        const quantityInput = lastItem.querySelector('[name^="quantity-"]');
                        const priceInput = lastItem.querySelector('[name^="unit-price-"]');
                        const vatSelect = lastItem.querySelector('[name^="vat-rate-"]');
                        
                        if (descInput) descInput.value = item.description || '';
                        if (quantityInput) quantityInput.value = item.quantity || '';
                        if (priceInput) priceInput.value = item.unit_price || '';
                        if (vatSelect) {
                            // Convert decimal TVA rate to integer format (20.00 -> 20)
                            const tvaRate = item.tva_rate || item.vat_rate || '';
                            const formattedRate = tvaRate ? parseFloat(tvaRate).toString() : '';
                            console.log(`Définition du taux TVA: ${tvaRate} -> ${formattedRate}`);
                            vatSelect.value = formattedRate;
                        }
                        
                        // Trigger calculation
                        if (quantityInput) quantityInput.dispatchEvent(new Event('input'));
                    }
                });
            } else {
                console.log('Aucun élément trouvé, ajout d\'un élément par défaut pour modification');
                // Clear existing items first
                const itemsContainer = document.getElementById('quote-items-container');
                if (itemsContainer) itemsContainer.innerHTML = '';
                // Add one default item if no items exist
                addQuoteItem();
            }
            
            // Load aides
            console.log('Chargement des aides du devis...');
            console.log('Tableau des aides du devis:', quote.aides);
            console.log('Longueur du tableau des aides:', quote.aides ? quote.aides.length : 'non défini');
            
            if (quote.aides && quote.aides.length > 0) {
                console.log('Trouvé', quote.aides.length, 'aides à charger');
                quote.aides.forEach((aide, index) => {
                    console.log(`Chargement de l'aide ${index + 1}:`, aide);
                    addAide();
                    const aideElements = document.querySelectorAll('.aide-item');
                    const lastAide = aideElements[aideElements.length - 1];
                    
                    if (lastAide) {
                        const nameInput = lastAide.querySelector('[name^="aide-name-"]');
                        const amountInput = lastAide.querySelector('[name^="aide-amount-"]');
                        
                        if (nameInput) nameInput.value = aide.name || '';
                        if (amountInput) amountInput.value = aide.amount || '';
                    }
                });
            }
            
            // Store quote ID for updating instead of creating new
            const quoteForm = document.getElementById('quote-form');
            if (quoteForm) {
                quoteForm.dataset.editQuoteId = quoteId;
                
                // Update submit button text
                const submitBtn = quoteForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = 'Mettre à jour le Devis';
                }
                
                // Scroll to the quote form
                quoteForm.scrollIntoView({ behavior: 'smooth' });
            }
            
            console.log('Devis chargé pour modification:', quote);
            
        } catch (error) {
            console.error('Erreur lors du chargement du devis pour modification:', error);
            alert('Échec du chargement du devis pour modification');
            // Remove edit parameter from URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };
    
    // Check for edit mode on page load
    const urlParams = new URLSearchParams(window.location.search);
    const editQuoteId = urlParams.get('edit-quote');
    
    console.log('Initialisation de la page - Paramètres URL:', window.location.search);
    console.log('ID de devis à modifier détecté:', editQuoteId);
    
    // Initialize the page
    fetchClients();
    fetchQuotes();
    addQuoteItem(); // Start with one item
    
    // Load quote for editing if edit-quote parameter exists
    if (editQuoteId) {
        console.log('Appel de loadQuoteForEdit avec l\'ID:', editQuoteId);
        // Add a small delay to ensure DOM elements are fully loaded
        setTimeout(() => {
            loadQuoteForEdit(editQuoteId);
        }, 100);
    } else {
        console.log('Aucun ID de devis à modifier trouvé, pas de chargement de devis pour modification');
    }
});