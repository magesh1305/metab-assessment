const API_URL = 'http://localhost:4000/api';

export async function api(user, path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (user) {
        headers['x-user-role'] = user.role;
        headers['x-user-id'] = String(user.id);
    }

    const response = await fetch(API_URL + path, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}