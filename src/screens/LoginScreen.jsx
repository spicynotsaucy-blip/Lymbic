import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, signUp, user, loading } = useAuth();
    const [mode, setMode] = useState('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (mode === 'signin') {
                await signIn(email, password);
            } else {
                await signUp(email, password);
            }
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ justifyContent: 'center' }}>
                <p className="text-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            </motion.div>
        );
    }

    if (user) {
        navigate(from, { replace: true });
        return null;
    }

    return (
        <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ justifyContent: 'center', padding: 'var(--space-lg)' }}>
            <div className="glass-card" style={{ maxWidth: 360, width: '100%' }}>
                <h1 className="text-title" style={{ marginBottom: 'var(--space-md)' }}>
                    {mode === 'signin' ? 'Sign in' : 'Create account'}
                </h1>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="text-body" style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-glass-border)', background: 'var(--surface-base)', color: 'var(--text-primary)' }} />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="text-body" style={{ padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-glass-border)', background: 'var(--surface-base)', color: 'var(--text-primary)' }} />
                    {error && <p className="text-small" style={{ color: 'var(--grade-f)' }}>{error}</p>}
                    <motion.button type="submit" className="btn-primary" disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
                    </motion.button>
                </form>
                <button type="button" className="text-small" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                </button>
            </div>
            <motion.button className="text-body" onClick={() => navigate('/')} style={{ marginTop: 'var(--space-xl)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Back to home
            </motion.button>
        </motion.div>
    );
}
