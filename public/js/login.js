document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const errorEl = document.getElementById('login-error');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.accessToken);
            window.location.href = '/dashboard.html';
        } else {
            const data = await response.json();
            errorEl.textContent = data.message || 'Login failed.';
        }
    } catch (error) {
        errorEl.textContent = 'An error occurred. Please try again.';
    }
});
