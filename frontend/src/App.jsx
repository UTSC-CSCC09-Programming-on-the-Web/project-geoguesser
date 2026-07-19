import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCheckoutSuccess = params.get('success');

    const checkSession = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        return data.user;
      } catch (error) {
        return null;
      }
    };

    if (isCheckoutSuccess) {
      setLoading(true);

      // Poll every 1.5 seconds to check if the subscription status has been updated in the backend
      const pollInterval = setInterval(async () => {
        const currentUser = await checkSession();

        if (currentUser?.status === 'active') {
          clearInterval(pollInterval);
          setUser(currentUser);
          setLoading(false);

          // remove ?success=true from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }, 1500);

      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
      }, 15000);

    } else {
      checkSession().then((currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
    }
  }, []);

  const handleLogout = () => {
    fetch('http://localhost:3000/auth/logout', { credentials: 'include' })
      .then(() => setUser(null));
  };

  if (loading) return <div>Loading account configuration...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Geo Guesser</h1>
        {user ? (
          <div>
            <h2>Welcome, {user.name}!</h2>
            <p>Logged in as: {user.email}</p>

            <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ccc' }}>
              <h3>Account Status: {user.status?.toUpperCase() || 'UNKNOWN'}</h3>

              {user.status === 'pending_payment' && (
                <button
                  onClick={async () => {
                    const res = await fetch('http://localhost:3000/api/create-checkout-session', {
                      method: 'POST',
                      credentials: 'include'
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url; // Redirect to Stripe
                  }}
                  style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Subscribe to Continue
                </button>
              )}
            </div>

            <button onClick={handleLogout}>Log Out</button>
          </div>
        ) : (
        <div>
          <h2>Please log in to continue.</h2>
          <a
            href="http://localhost:3000/auth/google"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4285F4',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Sign in with Google
          </a>
        </div>
      )}
    </div>
  );
}

export default App;