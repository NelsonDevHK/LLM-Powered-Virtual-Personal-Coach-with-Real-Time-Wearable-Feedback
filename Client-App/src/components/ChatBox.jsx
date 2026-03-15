import { useState, useRef, useEffect } from 'react';
import { getToken } from '../api/auth';
import './ChatBox.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function ChatBox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Persist chat history in sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('chatHistory');
    if (saved) setMessages(JSON.parse(saved));
  }, []);
  useEffect(() => {
    sessionStorage.setItem('chatHistory', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const newMessages = [...messages, { sender: 'user', text: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = getToken();
      const resp = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            ...newMessages.filter(m => m.sender === 'user').map(m => ({ role: 'user', content: m.text }))
          ]
        }),
      });
      const data = await resp.json();
      if (data.result) {
        setMessages(msgs => [...msgs, { sender: 'llm', text: typeof data.result === 'string' ? data.result : JSON.stringify(data.result) }]);
      } else {
        setMessages(msgs => [...msgs, { sender: 'llm', text: data.error || 'No response from LLM' }]);
      }
    } catch (err) {
      setMessages(msgs => [...msgs, { sender: 'llm', text: 'Error contacting server' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbox-container">
      <div className="chatbox-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chatbox-message ${msg.sender}`}>
            <span>{msg.text}</span>
          </div>
        ))}
        {loading && (
          <div className="chatbox-message llm loading">
            <span className="chatbox-loading-bubble">● ● ●</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <textarea
        className="chatbox-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        rows={2}
        disabled={loading}
      />
      <button className="chatbox-send" onClick={handleSend} disabled={loading}>Send</button>
    </div>
  );
}
