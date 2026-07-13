import { useEffect, useRef, useState } from 'react';
import { getSseToken } from '../api/admin';

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)} h`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;

    let es;
    let cancelled = false;

    // Pedimos un token EFÍMERO (con el JWT principal en el header) y recién con
    // él abrimos el stream. Así el JWT principal nunca va en la URL del SSE.
    getSseToken()
      .then(({ token: sseToken }) => {
        if (cancelled) return;
        es = new EventSource(`/api/admin/notifications/stream?token=${sseToken}`);
        es.onmessage = (e) => {
          const turn = JSON.parse(e.data);
          setNotifications((prev) =>
            [{ ...turn, _receivedAt: new Date().toISOString() }, ...prev].slice(0, 30),
          );
          setUnread((prev) => prev + 1);
        };
        es.onerror = () => es.close();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    setUnread(0);
  };

  const handleClear = () => {
    setNotifications([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={handleToggle}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        title="Notificaciones"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-white shadow-xl ring-1 ring-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
            {notifications.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Limpiar
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Sin notificaciones</p>
          ) : (
            <ul className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Nuevo turno #{String(n.number).padStart(3, '0')}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {n.customerName} · {n.scheduledDate} {n.scheduledTime}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {timeAgo(n._receivedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
