import './App.css';
import { useEffect, useState } from 'react';
import Login from './components/Login.jsx';
import Navbar from './components/Navbar.jsx';
import Dashboard from './components/Dashboard.jsx';
import Report from './components/Report.jsx';
import ChatBox from './components/ChatBox.jsx';
import { getToken, clearToken } from './api/auth.js';

function App() {
  const [status, setStatus] = useState('checking...');
  const [token, setToken] = useState(getToken());
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    fetch('http://localhost:3000/api/health')
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => setStatus('error'));
  }, []);

  // if not logged in, show login form
  if (!token) {
    return <Login onSuccess={(tok) => setToken(tok)} />;
  }

  return (
    <>
      <Navbar
        currentView={currentView}
        onChangeView={setCurrentView}
        onLogout={() => {
          clearToken();
          setToken(null);
        }}
      />
      <div className="app-title">
        LLM-Powered-Virtual-Personal-Coach-with-Real-Time-Wearable-Feedback
      </div>
      <div className="view-container">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'report' && <Report />}
      </div>
      <ChatBox onSend={async (msg) => {
        // Placeholder: Replace with LLM API call
        return 'LLM reply: ' + msg;
      }} />
    </>
  );
}

export default App;
