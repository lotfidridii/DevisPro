document.addEventListener('DOMContentLoaded', () => {
    const clientsTbody = document.getElementById('clients-tbody');
    const addClientBtn = document.getElementById('add-client-btn');
    const clientFormSection = document.getElementById('client-form-section');
    const clientForm = document.getElementById('client-form');
    const clientFormTitle = document.getElementById('client-form-title');
    const cancelClientFormBtn = document.getElementById('cancel-client-form');
    const quoteClientSelect = document.getElementById('quote-client');
    const quoteForm = document.getElementById('quote-form');
    const addItemBtn = document.getElementById('add-item-btn');
    const quoteItemsDiv = document.getElementById('quote-items');
    const quotesTbody = document.getElementById('quotes-tbody');

    let clients = [];
    let editingClientId = null;

    // Fetch and display clients
    const fetchClients = async () => {
        try {
            const response = await fetch('/api/clients');
            clients = await response.json();
            renderClients();
            populateClientSelect();
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    // Render clients in the table
    const renderClients = () => {
        clientsTbody.innerHTML = '';
        clients.forEach(client => {
            const row = `
                <tr>
                    <td>${client.name}</td>
                    <td>${client.address}</td>
                    <td>${client.phone}</td>
                    <td>${client.email}</td>
                    <td class="actions">
                        <button onclick="editClient(${client.id})">Edit</button>
                        <button onclick="deleteClient(${client.id})">Delete</button>
                    </td>
                </tr>
            `;
            clientsTbody.innerHTML += row;
        });
    };

    // Populate client dropdown for quote generator
    const populateClientSelect = () => {
        quoteClientSelect.innerHTML = '<option value="">Select a client</option>';
        clients.forEach(client => {
            const option = `<option value="${client.id}">${client.name}</option>`;
            quoteClientSelect.innerHTML += option;
        });
    };

    // Show client form
    const showClientForm = (isEdit = false, client = null) => {
        clientFormSection.classList.remove('hidden');
        if (isEdit) {
            clientFormTitle.textContent = 'Edit Client';
            document.getElementById('client-id').value = client.id;
            document.getElementById('name').value = client.name;
            document.getElementById('address').value = client.address;
            document.getElementById('phone').value = client.phone;
            document.getElementById('email').value = client.email;
            editingClientId = client.id;
        } else {
            clientFormTitle.textContent = 'Add Client';
            clientForm.reset();
            editingClientId = null;
        }
    };

    // Hide client form
    const hideClientForm = () => {
        clientFormSection.classList.add('hidden');
        clientForm.reset();
        editingClientId = null;
    };

    addClientBtn.addEventListener('click', () => showClientForm());
    cancelClientFormBtn.addEventListener('click', hideClientForm);

    // Handle client form submission (add/edit)
    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientData = {
            name: document.getElementById('name').value,
            address: document.getElementById('address').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
        };

        const method = editingClientId ? 'PUT' : 'POST';
        const url = editingClientId ? `/api/clients/${editingClientId}` : '/api/clients';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientData),
            });
            if (response.ok) {
                hideClientForm();
                fetchClients();
            } else {
                console.error('Failed to save client');
            }
        } catch (error) {
            console.error('Error saving client:', error);
        }
    });

    // Edit client
    window.editClient = (id) => {
        const client = clients.find(c => c.id === id);
        if (client) {
            showClientForm(true, client);
        }
    };

    // Delete client
    window.deleteClient = async (id) => {
        if (confirm('Are you sure you want to delete this client?')) {
            try {
                const response = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    fetchClients();
                } else {
                    console.error('Failed to delete client');
                }
            } catch (error) {
                console.error('Error deleting client:', error);
            }
        }
    };

    // Add item to quote form
    addItemBtn.addEventListener('click', () => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('item');
        itemDiv.innerHTML = `
            <input type="text" placeholder="Article Name" class="item-article-name" required>
            <input type="text" placeholder="Description" class="item-desc">
            <input type="number" placeholder="Qty" class="item-qty" value="1" min="1" required>
            <input type="number" placeholder="Unit Price (HT)" class="item-price-ht" step="0.01" min="0" required>
            <input type="number" placeholder="TVA (%)" class="item-tva" value="20" step="0.01" min="0" required>
            <button type="button" onclick="this.parentElement.remove()">Remove</button>
        `;
        quoteItemsDiv.appendChild(itemDiv);
    });

    // Handle quote form submission
    quoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientId = quoteClientSelect.value;
        const client = clients.find(c => c.id === parseInt(clientId));
        if (!client) {
            alert('Please select a client.');
            return;
        }

        const items = [];
        const itemElements = quoteItemsDiv.querySelectorAll('.item');
        itemElements.forEach(itemEl => {
            items.push({
                article_name: itemEl.querySelector('.item-article-name').value,
                description: itemEl.querySelector('.item-desc').value,
                quantity: parseFloat(itemEl.querySelector('.item-qty').value) || 0,
                unit_price_ht: parseFloat(itemEl.querySelector('.item-price-ht').value) || 0,
                tva: parseFloat(itemEl.querySelector('.item-tva').value) || 0,
            });
        });

        if (items.length === 0) {
            alert('Please add at least one item.');
            return;
        }

        const quoteData = {
            client,
            items,
            type: document.getElementById('quote-type').value,
        };

        try {
            const response = await fetch('/api/generate-quote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData),
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                // The server now sends the file for download directly, but we also make it available immediately
                a.download = `${quoteData.client.name}-${quoteData.type}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(a);
                document.body.removeChild(a);

                // Refresh UI
                quoteForm.reset();
                quoteItemsDiv.innerHTML = '';
                fetchQuotes(); // Refresh the list of quotes
            } else {
                alert('Failed to generate PDF.');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
        }
    });

    // --- Quote List ---
    const fetchQuotes = async () => {
        try {
            const response = await fetch('/api/quotes');
            const quotes = await response.json();
            renderQuotes(quotes);
        } catch (error) {
            console.error('Error fetching quotes:', error);
        }
    };

    const renderQuotes = (quotes) => {
        quotesTbody.innerHTML = '';
        if (!quotes || quotes.length === 0) {
            quotesTbody.innerHTML = '<tr><td colspan="6">No quotes found.</td></tr>';
            return;
        }
        quotes.forEach(quote => {
            const row = `
                <tr>
                    <td>${quote.quote_ref}</td>
                    <td>${quote.client_name}</td>
                    <td>${new Date(quote.created_at).toLocaleDateString()}</td>
                    <td>${quote.document_type}</td>
                    <td>$${parseFloat(quote.total_ttc).toFixed(2)}</td>
                    <td class="actions">
                        <a href="/api/quotes/${quote.id}/download" class="button">Download</a>
                        <button onclick="sendQuoteByEmail(${quote.id})">Send Email</button>
                    </td>
                </tr>
            `;
            quotesTbody.innerHTML += row;
        });
    };

    window.sendQuoteByEmail = async (quoteId) => {
        if (!confirm('Are you sure you want to email this quote?')) return;
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Sending...';

        try {
            const response = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' });
            const result = await response.json();
            if (response.ok) {
                alert('Email sent successfully!');
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error sending email:', error);
            alert('An error occurred while sending the email.');
        } finally {
            button.disabled = false;
            button.textContent = 'Send Email';
        }
    };

    // Initial fetch
    fetchClients();
    fetchQuotes();
});
