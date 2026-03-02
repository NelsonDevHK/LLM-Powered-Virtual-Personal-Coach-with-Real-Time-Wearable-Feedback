export default function Navbar({ currentView, onChangeView, onLogout }) {
  return (
    <nav className="navbar">
      <button onClick={() => onChangeView('dashboard')} disabled={currentView==='dashboard'}>Dashboard</button>
      <button onClick={() => onChangeView('wearable')} disabled={currentView==='wearable'}>Wearable</button>
      <button onClick={() => onChangeView('conversation')} disabled={currentView==='conversation'}>Conversation</button>
      <button onClick={onLogout}>Logout</button>
    </nav>
  );
}
