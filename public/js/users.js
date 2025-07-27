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

    if (userPayload.role !== 'super-admin') {
        alert('Access denied. You must be a super-admin to manage users.');
        window.location.href = '/dashboard.html';
        return;
    }

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const addUserForm = document.getElementById('add-user-form');
    const companySelect = document.getElementById('company');
    const usersTbody = document.getElementById('users-tbody');

    // Fetch companies to populate the dropdown
    const fetchCompanies = async () => {
        try {
            const response = await fetch('/api/companies', { headers });
            if (!response.ok) throw new Error('Failed to fetch companies');
            const companies = await response.json();
            
            companySelect.innerHTML = '<option value="">Select a company</option>';
            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                companySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching companies:', error);
            companySelect.innerHTML = '<option value="">Could not load companies</option>';
        }
    };

    // Fetch existing users to populate the table
    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users', { headers });
            if (!response.ok) throw new Error('Failed to fetch users');
            const users = await response.json();

            usersTbody.innerHTML = '';
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>${user.company_name || 'N/A'}</td>
                `;
                usersTbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Handle form submission to add a new user
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addUserForm);
        const userData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers,
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to create user');
            }

            addUserForm.reset();
            fetchUsers(); // Refresh the user list
            alert('User created successfully!');

        } catch (error) {
            console.error('Error creating user:', error);
            alert(`Error: ${error.message}`);
        }
    });

    // Logout functionality
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/index.html';
        });
    }

    // Initial data fetch
    fetchCompanies();
    fetchUsers();
});
