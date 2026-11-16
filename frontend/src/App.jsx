import React, { useState } from 'react';
import {
    Navigate,
    Route,
    Routes,
    useNavigate
} from 'react-router-dom';

import { getToken } from './api';

import Sidebar from './components/Sidebar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Inventory from './pages/Inventory';
import Drums from './pages/Drums';
import Processes from './pages/Processes';
import Production from './pages/Production';


function Protected({ children }) {
    return getToken()
        ? children
        : <Navigate to="/login" replace />;
}


export default function App() {

    const [user, setUser] = useState(
        JSON.parse(localStorage.getItem('ltms_user') || 'null')
    );

    const navigate = useNavigate();


    function logout() {
        localStorage.removeItem('ltms_token');
        localStorage.removeItem('ltms_user');

        setUser(null);

        navigate('/login');
    }


    return (
        <Routes>

            {/* LOGIN */}
            <Route
                path="/login"
                element={
                    <Login
                        onLogin={u => {
                            setUser(u);
                            navigate('/');
                        }}
                    />
                }
            />


            {/* PROTECTED APPLICATION */}
            <Route
                path="/*"
                element={
                    <Protected>

                        <div className="shell">

                            {/* SIDEBAR */}
                            <Sidebar
                                user={user}
                                onLogout={logout}
                            />


                            {/* MAIN CONTENT */}
                            <main className="main">

                                <header className="topbar">

                                    <div>
                                        <span className="eyebrow">
                                            TANNERY MANAGEMENT
                                        </span>

                                        <h1>
                                            Leather operations
                                        </h1>
                                    </div>

                                    <div className="user-chip">
                                        {user?.name || 'Supervisor'}
                                        {' · '}
                                        {user?.role || 'USER'}
                                    </div>

                                </header>


                                {/* APPLICATION ROUTES */}
                                <Routes>

                                    <Route
                                        path="/"
                                        element={<Dashboard />}
                                    />

                                    <Route
                                        path="/companies"
                                        element={<Companies />}
                                    />

                                    <Route
                                        path="/inventory"
                                        element={<Inventory />}
                                    />

                                    <Route
                                        path="/drums"
                                        element={<Drums />}
                                    />

                                    <Route
                                        path="/processes"
                                        element={<Processes />}
                                    />

                                    <Route
                                        path="/production"
                                        element={<Production />}
                                    />

                                </Routes>

                            </main>

                        </div>

                    </Protected>
                }
            />

        </Routes>
    );
}