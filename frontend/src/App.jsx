import React, { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated when app loads
  useEffect(() => {
    fetch('http://localhost:3000/api/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
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
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>Log Out</button>
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