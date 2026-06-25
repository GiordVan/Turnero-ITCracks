import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const navItems = [
  { to: '/admin/turnos', label: 'Turnos del día', icon: '📋' },
  { to: '/admin/notificaciones', label: 'Mensajes', icon: '💬' },
  { to: '/admin/config', label: 'Configuración', icon: '⚙️' },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <span className="text-lg font-bold text-gray-800">Turnero</span>
          <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
            Admin
          </span>
        </div>

        <nav className="flex-1 px-3 py-4">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="mb-2 px-2 text-xs text-gray-500">{user?.name}</div>
          <button
            onClick={handleSignOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end border-b border-gray-100 bg-white px-6 py-2.5">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
