import { useEffect, useState } from 'react';
import { getDailyTurns } from '../../api/admin';

const STATUS_CONFIG = {
  WAITING:     { label: 'Esperando',   cls: 'bg-gray-100 text-gray-700' },
  CALLED:      { label: 'Llamado',     cls: 'bg-yellow-100 text-yellow-700' },
  IN_PROGRESS: { label: 'En atención', cls: 'bg-brass/20 text-brick' },
  COMPLETED:   { label: 'Completado',  cls: 'bg-green-100 text-green-700' },
  CANCELLED:   { label: 'Cancelado',   cls: 'bg-red-100 text-red-700' },
};

function toLocalDateStr(date = new Date()) {
  return date.toLocaleDateString('sv-SE'); // produces YYYY-MM-DD in local TZ
}

function StatusBadge({ status }) {
  const { label, cls } = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100' };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

function StatsBar({ turns }) {
  const counts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = turns.filter((t) => t.status === s).length;
    return acc;
  }, {});

  return (
    <div className="mb-6 grid grid-cols-5 gap-3">
      {Object.entries(STATUS_CONFIG).map(([status, { label, cls }]) => (
        <div key={status} className="rounded-xl bg-white px-4 py-3 shadow-sm">
          <p className="text-2xl font-bold text-gray-800">{counts[status]}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

const ALL = 'ALL';

export default function TurnosPage() {
  const [date, setDate] = useState(toLocalDateStr());
  const [turns, setTurns] = useState([]);
  const [profFilter, setProfFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getDailyTurns(date)
      .then(setTurns)
      .catch(() => setError('No se pudo cargar la lista de turnos.'))
      .finally(() => setLoading(false));
  }, [date]);

  // Peluqueros presentes en los turnos del día (para el filtro de agenda)
  const professionals = Array.from(
    new Map(
      turns
        .filter((t) => t.professional)
        .map((t) => [t.professional.id, t.professional]),
    ).values(),
  );

  const visibleTurns =
    profFilter === ALL ? turns : turns.filter((t) => t.professionalId === profFilter);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800">Agenda del día</h1>
        <div className="flex items-center gap-2">
          <select
            value={profFilter}
            onChange={(e) => setProfFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          >
            <option value={ALL}>Todos los peluqueros</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
        </div>
      </div>

      {/* Stats */}
      {!loading && !error && <StatsBar turns={visibleTurns} />}

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : visibleTurns.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400">Sin turnos para esta fecha.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Hora</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Peluquero</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibleTurns.map((turn) => (
                <tr
                  key={turn.id}
                  className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50"
                >
                  <td className="px-5 py-3.5 font-semibold text-gray-700">
                    {String(turn.number).padStart(3, '0')}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-700">
                    {turn.scheduledTime ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-800">
                    {turn.customerName ?? <span className="text-gray-400">Sin nombre</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {turn.professional?.name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={turn.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
