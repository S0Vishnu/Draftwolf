import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { toast } from 'react-toastify';
import logoFull from '../assets/logo_full.svg';
import '../styles/AuthShared.css';

// ... (Icons remain same, skipping to Logic)

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#FFFFFF" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#FFFFFF" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FFFFFF" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#FFFFFF" />
    </svg>
);

const Login = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [linkSent, setLinkSent] = useState(false);
    const navigate = useNavigate();

    // Auto-redirect logic moved to App.tsx
    // React.useEffect(() => {
    //     if (user) {
    //         console.log("Session restored, redirecting...");
    //         navigate('/home', { replace: true });
    //     }
    // }, [user, navigate]);

    React.useEffect(() => {
        const api = globalThis.api;
        if (!api?.auth) return;

        const cleanup = api.auth.onAuthSuccess(async (sessionData) => {
            console.log("Auth success event received in renderer:", sessionData);
            try {
                toast.info("Verifying session...");
                const { accessToken, refreshToken } = typeof sessionData === 'string'
                    ? { accessToken: sessionData, refreshToken: '' }
                    : sessionData;

                console.log("Setting Supabase session...");
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                });

                if (error) {
                    console.error("Supabase setSession error:", error);
                    throw error;
                }

                console.log("Session set successfully:", data);
                toast.success("Successfully logged in!");
                navigate('/home', { replace: true });
            } catch (error: any) {
                console.error("Token sign-in failed:", error);
                toast.error("Auth failed: " + error.message);
            }
        });

        const errorCleanup = api.auth.onAuthError((error) => {
            console.error("Auth error event received in renderer:", error);
            toast.error(error);
            setLoading(false);
        });

        // Check for existing session token on mount
        api.auth.getToken().then((token) => {
            if (token) {
                supabase.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => { });
            }
        });

        return () => {
            cleanup();
            errorCleanup();
        };
    }, [navigate]);

    // Effect to handle navigation on successful login
    React.useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                navigate('/home', { replace: true });
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.warn("Please enter your email");
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: 'myapp://auth',
                }
            });

            if (error) throw error;

            setLinkSent(true);
            toast.success("Login link sent! Check your inbox.");

        } catch (error: any) {
            console.error("Email Link Error:", error);
            toast.error("Failed to send link: " + error.message);
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="login-container">
            <div className="glow"></div>
            <div className="login-card">
                <div className="brand-header">
                    <img src={logoFull} alt="DRAFTWOLF" className="brand-logo-img" />
                </div>

                <p className="login-subtitle">Log In or Register with your email.</p>

                <button
                    className="google-btn"
                    onClick={async () => {
                        try {
                            setLoading(true);
                            const { data, error } = await supabase.auth.signInWithOAuth({
                                provider: 'google',
                                options: {
                                    redirectTo: 'https://draftwolf-authentication.netlify.app/auth-redirect.html',
                                    skipBrowserRedirect: true,
                                    queryParams: {
                                        prompt: 'select_account'
                                    }
                                }
                            });

                            if (error) throw error;

                            if (data?.url) {
                                const api = globalThis.api;
                                if (api?.openExternal) {
                                    await api.openExternal(data.url);
                                    toast.info("Opening browser for login...");
                                } else {
                                    window.location.href = data.url;
                                }
                            }
                        } catch (error: any) {
                            console.error("Google Auth Error:", error);
                            toast.error("Google login failed: " + error.message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                    style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
                >
                    <div className="icon-wrapper">
                        {loading ? <div className="spinner" style={{ width: '20px', height: '20px' }}></div> : <GoogleIcon />}
                    </div>
                    <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
                </button>

                <div className="divider">
                    <div className="line"></div>
                </div>

                {linkSent ? (
                    <div className="email-sent-state" style={{ textAlign: 'center', margin: '20px 0' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📧</div>
                        <h3 style={{ marginBottom: '10px' }}>Check your inbox</h3>
                        <p style={{ color: '#888', marginBottom: '20px' }}>
                            We sent a login link to <strong>{email}</strong>.<br />
                            Click the link to sign in.
                        </p>
                        <button
                            className="back-btn"
                            style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => setLinkSent(false)}
                        >
                            Back to login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleEmailSignIn} className="email-form">
                        <input
                            type="email"
                            placeholder="name@gmail.com"
                            className="email-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                        <button type="submit" className="continue-btn" disabled={loading}>
                            {loading ? 'Sending Link...' : 'Continue'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
