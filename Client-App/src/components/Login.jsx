import { useState } from 'react';
import { login, register, setToken } from '../api/auth';

export default function Login({ onSuccess }) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    const resp = await login(userName, password);
    if (resp.success && resp.token) {
      setToken(resp.token);
      onSuccess(resp.token, resp.user);
    } else {
      setMessage(resp.error || 'login failed');
    }
  };

  const handleRegister = async () => {
    const resp = await register({ user_name: userName, password });
    if (resp.success) {
      setMessage('registration succeeded, please login');
    } else {
      setMessage(resp.error || 'register failed');
    }
  };

  return (
    <div className="login-form">
      <h2>Login / Register</h2>
      <input
        placeholder="username"
        value={userName}
        onChange={e => setUserName(e.target.value)}
      />
      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <div className="buttons">
        <button onClick={handleLogin}>Login</button>
        <button onClick={handleRegister}>Register</button>
      </div>
      {message && <p className="message">{message}</p>}
    </div>
  );
}
