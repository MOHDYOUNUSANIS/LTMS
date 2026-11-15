import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ user, onLogout }) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark">L</div>
                <div>
                    <strong>LTMS</strong>
                    <small>Leather Tanning OS</small>
                </div>
            </div>

            <div className="nav-label">WORKSPACE</div>

            <nav>
                <NavLink end to="/">
                    ◫ <span>Dashboard</span>
                </NavLink>

                <NavLink to="/companies">
                    ▦ <span>Companies</span>
                </NavLink>

                <NavLink to="/drums">
                    ◉ <span>Drum Management</span>
                </NavLink>

                <NavLink to="/inventory">
                    ◈ <span>Chemical inventory</span>
                </NavLink>

                <NavLink to="/processes">
                    ⚗ <span>Process Library</span>
                </NavLink>
            </nav>

            <div className="sidebar-bottom">
                <div className="profile">
                    <div className="avatar">
                        {(user?.name || 'S').slice(0, 1).toUpperCase()}
                    </div>

                    <div>
                        <b>{user?.name || 'Supervisor'}</b>
                        <small>{user?.code || 'Signed in'}</small>
                    </div>
                </div>

                <button className="logout" onClick={onLogout}>
                    ↗ Sign out
                </button>
            </div>
        </aside>
    );
}