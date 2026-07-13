import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyTurns, cancelTurn } from '../api/public';

const STATUS_LABEL = {
  WAITING:     'Reservado',
  CALLED:      'Llamado',
  IN_PROGRESS: 'En atención',
  COMPLETED:   'Completado',
  CANCELLED:   'Cancelado',
};

const STATUS_CLS = {
  WAITING:     'bg-brass/20 text-brick',
  CALLED:      'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-brass/20 text-wood',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-red-100 text-red-700',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

const CANCELLABLE = ['WAITING', 'CALLED'];

export default function MisTurnosPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [turns, setTurns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const handleCancel = async (id) => {
    if (!window.confirm('¿Seguro que querés cancelar este turno?')) return;
    setCancelling(id);
    try {
      await cancelTurn(id, email);
      setTurns((prev) => prev.map((t) => t.id === id ? { ...t, status: 'CANCELLED' } : t));
    } catch {
      alert('No se pudo cancelar el turno. Intentá de nuevo.');
    } finally {
      setCancelling(null);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    setTurns(null);
    try {
      const data = await getMyTurns(email);
      setTurns(data);
    } catch (err) {
      // En F0 la consulta por email está deshabilitada (el backend responde 410
      // con un mensaje claro). Se re-habilita con verificación (OTP) en F1.
      setError(err?.message || 'No se pudo consultar. Verificá tu correo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-cream to-paper p-6 pt-16">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/kiosko')}
          className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver
        </button>

        <div className="rounded-2xl bg-white p-8 shadow-md">
          <h2 className="mb-1 text-2xl font-bold text-gray-800">Mis turnos</h2>
          <p className="mb-4 text-sm text-gray-500">
            Ingresá tu correo para ver tus reservas.
          </p>
          <p className="mb-6 rounded-lg bg-cream px-3 py-2 text-xs text-wood">
            Por seguridad, la consulta por correo está temporalmente deshabilitada.
            Gestioná tu turno desde la confirmación de tu reserva; pronto vas a poder
            consultarlos con un código de verificación.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-brick px-5 py-2.5 text-sm font-semibold text-white hover:bg-brick-dark disabled:opacity-60"
            >
              {loading ? '...' : 'Buscar'}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>

        {/* Results */}
        {turns !== null && (
          <div className="mt-5">
            {turns.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-md">
                <p className="text-4xl">📭</p>
                <p className="mt-3 font-semibold text-gray-700">No posee turnos reservados</p>
                <button
                  onClick={() => navigate('/kiosko/reservar')}
                  className="mt-4 rounded-xl bg-brick px-6 py-2.5 text-sm font-semibold text-white hover:bg-brick-dark"
                >
                  Sacar un turno
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {turns.map((turn) => (
                  <div key={turn.id} className="rounded-2xl bg-white p-5 shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize text-gray-500">
                          {formatDate(turn.scheduledDate)}
                        </p>
                        <p className="mt-0.5 text-2xl font-black text-gray-800">
                          {turn.scheduledTime}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Turno N.° {String(turn.number).padStart(3, '0')}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLS[turn.status] ?? 'bg-gray-100'}`}
                      >
                        {STATUS_LABEL[turn.status] ?? turn.status}
                      </span>
                    </div>

                    {CANCELLABLE.includes(turn.status) && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <button
                          onClick={() => handleCancel(turn.id)}
                          disabled={cancelling === turn.id}
                          className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {cancelling === turn.id ? 'Cancelando...' : 'Cancelar turno'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
