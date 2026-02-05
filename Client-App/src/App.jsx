import './App.css';
import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    fetch('http://localhost:3000/api/health')
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <>
      <div className="Navbar">
        LLM-Powered-Virtual-Personal-Coach-with-Real-Time-Wearable-Feedback
      </div>
      <p>API status: {status}</p>
      {/* SPA for switching login form and component */}
    </>
  );
}

export default App;
