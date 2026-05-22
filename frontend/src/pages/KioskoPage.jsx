import { useNavigate } from 'react-router-dom';

export default function KioskoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-gray-800">Bienvenido</h1>
        <p className="mt-3 text-lg text-gray-500">¿Qué querés hacer hoy?</p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-5 sm:grid-cols-2">
        <button
          onClick={() => navigate('/kiosko/reservar')}
          className="group flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-10 shadow-md transition-all hover:scale-105 hover:shadow-xl"
        >
          <span className="text-6xl">📅</span>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">Sacar turno</p>
            <p className="mt-1 text-sm text-gray-400">Reservá un turno para la fecha que prefieras</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/kiosko/mis-turnos')}
          className="group flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-10 shadow-md transition-all hover:scale-105 hover:shadow-xl"
        >
          <span className="text-6xl">🔍</span>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800">Mis turnos</p>
            <p className="mt-1 text-sm text-gray-400">Consultá tus reservas con tu correo</p>
          </div>
        </button>
      </div>
    </div>
  );
}
