import { getIdToken } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const authHeaders = async () => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchSessions = async () => {
    try {
        const resp = await fetch(`${API_URL}/sessions`, { headers: await authHeaders() });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return (await resp.json()).sessions;
    } catch (err) {
        console.error('Failed to fetch sessions:', err);
        return [];
    }
};

export const fetchSession = async (id) => {
    try {
        const resp = await fetch(`${API_URL}/sessions/${id}`, { headers: await authHeaders() });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    } catch (err) {
        console.error('Failed to fetch session:', err);
        return null;
    }
};
