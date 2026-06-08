import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>📈 Investment Tracker</h1>
        <div className="user-info">
          <span>Welcome, {user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="hero">
          <h2>Dashboard</h2>
          <p>Your investment tracking system is ready!</p>
        </section>

        <section className="features">
          <h3>Features</h3>
          <ul>
            <li>✓ Track investment positions</li>
            <li>✓ Calculate break-even price</li>
            <li>✓ Monitor profit/loss with tax considerations</li>
            <li>✓ Set price targets (1%, 2%, 5%, 10% profit)</li>
            <li>✓ Trailing stop management</li>
            <li>✓ Real-time price updates via Yahoo Finance</li>
          </ul>
        </section>

        <div className="coming-soon">
          <p>More features coming soon...</p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
