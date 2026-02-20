/**
 * Auth context: Supabase Auth (email/password). Provides user, session, signIn, signUp, signOut.
 * When Supabase is not configured, auth is effectively disabled (user stays null).
 */
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    return ctx || { user: null, session: null, loading: true, signIn: async () => {}, signUp: async () => {}, signOut: async () => {} };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { getSupabase } = await import('../lib/storageLayer');
                const supabase = await getSupabase();
                if (!supabase) {
                    setLoading(false);
                    return;
                }
                const { data: { session: s } } = await supabase.auth.getSession();
                if (mounted) {
                    setSession(s);
                    setUser(s?.user ?? null);
                }
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
                    if (mounted) {
                        setSession(s);
                        setUser(s?.user ?? null);
                    }
                });
                return () => subscription?.unsubscribe();
            } catch (e) {
                console.warn('[Lymbic] Auth init failed:', e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const signIn = async (email, password) => {
        const { getSupabase } = await import('../lib/storageLayer');
        const supabase = await getSupabase();
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    const signUp = async (email, password, options = {}) => {
        const { getSupabase } = await import('../lib/storageLayer');
        const supabase = await getSupabase();
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error } = await supabase.auth.signUp({ email, password, options });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        const { getSupabase } = await import('../lib/storageLayer');
        const supabase = await getSupabase();
        if (supabase) await supabase.auth.signOut();
        setSession(null);
        setUser(null);
    };

    const value = { user, session, loading, signIn, signUp, signOut };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
