import { useEffect, useState } from 'react';
import { getNotifications } from '../../api/admin';

const TYPE_CONFIG = {
  CONFIRMATION: { label: 'Confirmación', cls: 'bg-brass/20 text-brick' },
  REMINDER:     { label: 'Recordatorio', cls: 'bg-purple-100 text-purple-700' },
};

const STATUS_CONFIG = {
  SIMULATED: { label: 'Simulado', cls: 'bg-gray-100 text-gray-600' },
  SENT:      { label: 'Enviado',  cls: 'bg-green-100 text-green-700' },
  FAILED:    { label: 'Falló',    cls: 'bg-red-100 text-red-700' },
};

function TypeBadge({ type }) {
  const { label, cls } = TYPE_CONFIG[type] ?? { label: type, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

function StatusBadge({ status }) {
  const { label, cls } = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getNotifications()
      .then(setNotifications)
      .catch(() => setError('No se pudo cargar la lista de mensajes.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Mensajes enviados</h1>
        <p className="mt-1 text-sm text-gray-500">Confirmaciones y recordatorios de WhatsApp.</p>
      </div>

      {/* Content */}
      <div className="rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400">Todavía no se envió ningún mensaje.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div key={n.id} className="px-5 py-4">
                {/* Top row: badges + channel + sentAt */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">💬 WhatsApp</span>
                  <TypeBadge type={n.type} />
                  <StatusBadge status={n.status} />
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(n.sentAt).toLocaleString('es-AR')}
                  </span>
                </div>

                {/* Message body */}
                <p className="mb-3 whitespace-pre-wrap rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {n.body}
                </p>

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>
                    <span className="font-medium text-gray-700">Destinatario:</span> {n.toAddress}
                  </span>
                  {n.turn?.customerName && (
                    <span>
                      <span className="font-medium text-gray-700">Cliente:</span> {n.turn.customerName}
                    </span>
                  )}
                  {n.turn?.scheduledDate && (
                    <span>
                      <span className="font-medium text-gray-700">Turno:</span>{' '}
                      {n.turn.scheduledDate} {n.turn.scheduledTime}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
