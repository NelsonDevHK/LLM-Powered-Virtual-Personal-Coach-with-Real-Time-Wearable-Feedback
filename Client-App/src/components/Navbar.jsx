export default function Navbar({ currentView, onChangeView, onLogout }) {
  return (
    <nav className="navbar">
      <div className="nav-group">
        <button onClick={() => onChangeView('dashboard')} disabled={currentView==='dashboard'}>Dashboard</button>
        <button onClick={() => onChangeView('report')} disabled={currentView==='report'}>Report</button>
      </div>
      <button className="logout-btn" onClick={onLogout}>Logout</button>
    </nav>
  );
}
