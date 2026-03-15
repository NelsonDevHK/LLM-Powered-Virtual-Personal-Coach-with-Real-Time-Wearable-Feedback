import { useState } from 'react';
import { login, register, setToken } from '../api/auth';

export default function Login({ onSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [exerciseLevel, setExerciseLevel] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [injuries, setInjuries] = useState('');
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
    const user = {
      user_name: userName,
      password,
      name,
      gender,
      age,
      exercise_level: exerciseLevel,
      fitness_goal: fitnessGoal,
      injuries,
    };
    const resp = await register(user);
    if (resp.success) {
      setMessage('Registration succeeded, please login');
      setIsRegister(false);
    } else {
      setMessage(resp.error || 'register failed');
    }
  };

  return (
    <div className="login-form">
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
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
      {isRegister && (
        <>
          <input
            placeholder="name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <select
            className="login-select"
            value={gender}
            onChange={e => setGender(e.target.value)}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <input
            placeholder="age"
            type="number"
            value={age}
            onChange={e => setAge(e.target.value)}
          />
          <select
            className="login-select"
            value={exerciseLevel}
            onChange={e => setExerciseLevel(e.target.value)}
          >
            <option value="">Select exercise level</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Athlete">Athlete</option>
          </select>
          <input
            placeholder="fitness goal"
            value={fitnessGoal}
            onChange={e => setFitnessGoal(e.target.value)}
          />
          <input
            placeholder="injuries (optional)"
            value={injuries}
            onChange={e => setInjuries(e.target.value)}
          />
        </>
      )}
      <div className="buttons">
        {isRegister ? (
          <>
            <button onClick={handleRegister}>Register</button>
            <button onClick={() => setIsRegister(false)}>Back to Login</button>
          </>
        ) : (
          <>
            <button onClick={handleLogin}>Login</button>
            <button onClick={() => setIsRegister(true)}>Register</button>
          </>
        )}
      </div>
      {message && <p className="message">{message}</p>}
    </div>
  );
}
