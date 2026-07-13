import { useEffect, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicConfig, getProfessionals, getAvailableSlots, createTurn, createDeposit, confirmDeposit, cancelTurn } from '../api/public';

// ── State machine ─────────────────────────────────────────────────────────────
// PROFESSIONAL → DATE → SLOT → FORM → CHECKOUT → DONE
// La disponibilidad depende del peluquero elegido, por eso es el primer paso.

const STEPS = { PROFESSIONAL: 'PROFESSIONAL', DATE: 'DATE', SLOT: 'SLOT', FORM: 'FORM', CHECKOUT: 'CHECKOUT', DONE: 'DONE' };

const initial = {
  step: STEPS.PROFESSIONAL,
  name: '',
  email: '',
  phone: '',
  workingDays: [],
  professionals: [],
  selectedProfessional: null,
  selectedDate: null,
  availableSlots: [],
  slotsLoading: false,
  selectedSlot: null,
  turn: null,
  deposit: null,
  paying: false,
  loading: true,
  error: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_INIT':
      return { ...state, workingDays: action.payload.workingDays, professionals: action.payload.professionals, loading: false };
    case 'SELECT_PROFESSIONAL':
      return { ...state, selectedProfessional: action.payload, step: STEPS.DATE, selectedDate: null, selectedSlot: null, availableSlots: [], error: '' };
    case 'BACK_TO_PROFESSIONAL':
      return { ...state, step: STEPS.PROFESSIONAL, selectedDate: null, selectedSlot: null, availableSlots: [], error: '' };
    case 'SELECT_DATE':
      return { ...state, selectedDate: action.payload, availableSlots: [], selectedSlot: null, slotsLoading: true, error: '' };
    case 'SET_SLOTS':
      return { ...state, availableSlots: action.payload, slotsLoading: false, step: STEPS.SLOT, error: '' };
    case 'SELECT_SLOT':
      return { ...state, selectedSlot: action.payload };
    case 'NEXT_FORM':
      return { ...state, step: STEPS.FORM, error: '' };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false, slotsLoading: false };
    case 'DONE':
      return { ...state, turn: action.turn, deposit: action.deposit, step: STEPS.DONE, loading: false, paying: false };
    case 'BACK_TO_DATE':
      return { ...state, step: STEPS.DATE, selectedDate: null, selectedSlot: null, availableSlots: [], error: '' };
    case 'BACK_TO_SLOT':
      return { ...state, step: STEPS.SLOT, error: '' };
    case 'TO_CHECKOUT':
      return { ...state, turn: action.turn, deposit: action.deposit, step: STEPS.CHECKOUT, loading: false, error: '' };
    case 'SET_PAYING':
      return { ...state, paying: action.payload };
    case 'BACK_TO_FORM':
      return { ...state, step: STEPS.FORM, error: '', paying: false };
    default:
      return state;
  }
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  return cells;
}

function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map((v, i) => (i === 1 ? v - 1 : +v));
  return new Date(y, m, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── Step: Professional ──────────────────────────────────────────────────────────

function ProfessionalStep({ professionals, selectedProfessional, onSelect, onBack }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← Volver al inicio
      </button>
      <h2 className="mb-1 text-xl font-bold text-gray-800">¿Con quién querés atenderte?</h2>
      <p className="mb-5 text-sm text-gray-500">Elegí el peluquero para ver sus horarios.</p>

      {professionals.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No hay peluqueros disponibles por el momento.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {professionals.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                selectedProfessional?.id === p.id
                  ? 'border-brick bg-brick text-white'
                  : 'border-gray-200 text-gray-800 hover:border-brass hover:bg-paper'
              }`}
            >
              <span>{p.name}</span>
              <span aria-hidden>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step: Calendar ────────────────────────────────────────────────────────────

function CalendarStep({ workingDays, selectedDate, onSelect, onBack }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());

  const isCurrentMonth = vy === today.getFullYear() && vm === today.getMonth();

  const go = (delta) => {
    let m = vm + delta, y = vy;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setVm(m); setVy(y);
  };

  const monthLabel = new Date(vy, vm, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const cells = buildGrid(vy, vm);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← Volver al inicio
      </button>
      <h2 className="mb-1 text-xl font-bold text-gray-800">Elegí una fecha</h2>
      <p className="mb-5 text-sm text-gray-500">Los días grises no están habilitados.</p>

      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={isCurrentMonth}
          className="rounded-xl p-2 text-xl text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-200"
        >
          ‹
        </button>
        <span className="text-base font-semibold capitalize text-gray-800">{monthLabel}</span>
        <button
          onClick={() => go(1)}
          className="rounded-xl p-2 text-xl text-gray-500 hover:bg-gray-100"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="py-1 text-center text-xs font-semibold text-gray-400">{h}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;

          const dateStr = day.toLocaleDateString('sv-SE');
          const isPast = day < tomorrow;
          const isNonWorking = !workingDays.includes(day.getDay());
          const disabled = isPast || isNonWorking;
          const isSelected = selectedDate === dateStr;
          const isToday = day.getTime() === today.getTime();

          return (
            <button
              key={dateStr}
              onClick={() => !disabled && onSelect(dateStr)}
              disabled={disabled}
              className={[
                'flex aspect-square items-center justify-center rounded-xl text-sm font-medium transition-colors',
                disabled
                  ? 'cursor-not-allowed text-gray-300'
                  : 'cursor-pointer text-gray-800 hover:bg-paper',
                isSelected && '!bg-brick !text-white',
                isToday && !disabled && !isSelected && 'ring-2 ring-brass ring-offset-1',
              ].filter(Boolean).join(' ')}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step: Slot ────────────────────────────────────────────────────────────────

function SlotStep({ date, slots, selectedSlot, onSelect, onNext, onBack, error, slotsLoading }) {
  const label = dateLabel(date);

  return (
    <div className="rounded-2xl bg-white p-8 shadow-md">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← Volver
      </button>
      <h2 className="mb-1 text-xl font-bold text-gray-800">Elegí un horario</h2>
      <p className="mb-5 text-sm capitalize text-gray-500">{label}</p>

      {slotsLoading ? (
        <p className="py-6 text-center text-sm text-gray-400">Cargando horarios...</p>
      ) : slots.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No hay turnos disponibles para este día.</p>
      ) : (
        <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => onSelect(slot)}
              className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                selectedSlot === slot
                  ? 'border-brick bg-brick text-white'
                  : 'border-gray-200 text-gray-700 hover:border-brass hover:bg-paper'
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={onNext}
        disabled={!selectedSlot || slotsLoading}
        className="w-full rounded-xl bg-brick py-3 text-base font-semibold text-white hover:bg-brick-dark disabled:opacity-50"
      >
        Continuar →
      </button>
    </div>
  );
}

// ── Step: Form ────────────────────────────────────────────────────────────────

function FormStep({ name, email, phone, date, time, professionalName, onChange, onSubmit, onBack, loading, error }) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-md">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← Volver
      </button>
      <h2 className="mb-1 text-2xl font-bold text-gray-800">Tus datos</h2>
      <p className="mb-4 text-sm text-gray-500">Completá tus datos para confirmar el turno.</p>

      {/* Summary */}
      <div className="mb-6 rounded-xl bg-cream px-4 py-3 text-sm">
        {professionalName && (
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">Peluquero</span>
            <span className="font-medium text-gray-800">{professionalName}</span>
          </div>
        )}
        <div className="flex justify-between py-0.5">
          <span className="text-gray-500">Fecha</span>
          <span className="font-medium capitalize text-gray-800">{dateLabel(date)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-gray-500">Hora</span>
          <span className="font-medium text-gray-800">{time}</span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Juan García"
            required
            autoFocus
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="juan@ejemplo.com"
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">WhatsApp</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="+54 9 11 1234-5678"
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
          <p className="mt-1 text-xs text-gray-400">Te enviaremos la confirmación y el recordatorio por WhatsApp.</p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-brick py-3 text-base font-semibold text-white hover:bg-brick-dark disabled:opacity-60"
        >
          {loading ? 'Reservando...' : 'Confirmar reserva'}
        </button>
      </form>
    </div>
  );
}

// ── Step: Checkout ────────────────────────────────────────────────────────────

function CheckoutStep({ deposit, professionalName, date, time, onPay, onBack, paying, error }) {
  const amount = deposit?.amount ?? 0;
  return (
    <div className="rounded-2xl bg-white p-8 shadow-md">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← Volver
      </button>
      <h2 className="mb-1 text-2xl font-bold text-gray-800">Seña para confirmar</h2>
      <p className="mb-5 text-sm text-gray-500">
        Dejá una seña para asegurar tu turno. Se descuenta del total del servicio.
      </p>

      <div className="mb-6 rounded-xl bg-cream px-4 py-3 text-sm">
        {professionalName && (
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">Peluquero</span>
            <span className="font-medium text-gray-800">{professionalName}</span>
          </div>
        )}
        <div className="flex justify-between py-0.5">
          <span className="text-gray-500">Fecha</span>
          <span className="font-medium capitalize text-gray-800">{dateLabel(date)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-gray-500">Hora</span>
          <span className="font-medium text-gray-800">{time}</span>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-brass bg-white px-5 py-4 text-center">
        <p className="text-sm text-gray-500">Monto de la seña</p>
        <p className="text-4xl font-black text-brick">${amount.toLocaleString('es-AR')}</p>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={onPay}
        disabled={paying}
        className="w-full rounded-xl bg-brick py-3 text-base font-semibold text-white hover:bg-brick-dark disabled:opacity-60"
      >
        {paying ? 'Procesando...' : `Pagar seña $${amount.toLocaleString('es-AR')}`}
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        Modo demo · no se cobra dinero real
      </p>
    </div>
  );
}

// ── Step: Done ────────────────────────────────────────────────────────────────

function DoneStep({ turn, deposit, professionalName, onNew, onHome }) {
  const label = dateLabel(turn.scheduledDate);

  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-md">
      <div className="mb-4 text-5xl">✅</div>
      <h2 className="text-2xl font-bold text-gray-800">¡Turno reservado!</h2>
      <p className="mt-2 text-sm text-gray-500">Guardá este número para el día de tu turno.</p>

      <div className="my-6 rounded-xl bg-brick px-6 py-5 text-white">
        <p className="text-sm font-medium opacity-80">Tu número de turno</p>
        <p className="text-6xl font-black">{String(turn.number).padStart(3, '0')}</p>
      </div>

      <div className="rounded-xl bg-gray-50 p-4 text-left text-sm">
        <div className="flex justify-between py-1.5">
          <span className="text-gray-500">Nombre</span>
          <span className="font-medium text-gray-800">{turn.customerName}</span>
        </div>
        {professionalName && (
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Peluquero</span>
            <span className="font-medium text-gray-800">{professionalName}</span>
          </div>
        )}
        <div className="flex justify-between py-1.5">
          <span className="text-gray-500">Fecha</span>
          <span className="font-medium capitalize text-gray-800">{label}</span>
        </div>
        <div className="flex justify-between py-1.5">
          <span className="text-gray-500">Hora</span>
          <span className="font-medium text-gray-800">{turn.scheduledTime}</span>
        </div>
        {deposit?.status === 'PAID' ? (
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Seña pagada</span>
            <span className="font-medium text-green-600">✓ ${Number(deposit.amount).toLocaleString('es-AR')}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={onHome}
          className="w-full rounded-xl bg-brick py-3 text-sm font-semibold text-white hover:bg-brick-dark"
        >
          Volver al inicio
        </button>
        <button
          onClick={onNew}
          className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reservar otro turno
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReservarPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initial);
  const { step, name, email, phone, workingDays, professionals, selectedProfessional, selectedDate, availableSlots, selectedSlot, turn, deposit, paying, loading, error, slotsLoading } = state;

  // Load config + professionals on mount
  useEffect(() => {
    Promise.all([getPublicConfig(), getProfessionals()])
      .then(([cfg, professionals]) =>
        dispatch({ type: 'SET_INIT', payload: { workingDays: cfg.workingDays, professionals } }))
      .catch(() => dispatch({ type: 'SET_ERROR', payload: 'No se pudo cargar la configuración.' }));
  }, []);

  // Load available slots whenever a date is selected (por peluquero)
  useEffect(() => {
    if (!selectedDate || !selectedProfessional) return;
    getAvailableSlots(selectedDate, selectedProfessional.id)
      .then((slots) => dispatch({ type: 'SET_SLOTS', payload: slots }))
      .catch(() => dispatch({ type: 'SET_ERROR', payload: 'No se pudieron cargar los horarios.' }));
  }, [selectedDate, selectedProfessional]);

  const handleConfirm = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: '' });
    let newTurn = null;
    try {
      newTurn = await createTurn({
        customerName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        scheduledDate: selectedDate,
        scheduledTime: selectedSlot,
        professionalId: selectedProfessional?.id,
      });
      // El backend devuelve un token de gestión ligado al turno; con él se paga
      // la seña o se cancela (reemplaza la autorización por email).
      const deposit = await createDeposit(newTurn.id, newTurn.manageToken);
      dispatch({ type: 'TO_CHECKOUT', turn: newTurn, deposit });
    } catch (e) {
      if (newTurn) {
        try { await cancelTurn(newTurn.id, newTurn.manageToken); } catch { /* cleanup best-effort */ }
      }
      dispatch({ type: 'SET_ERROR', payload: e.message || 'Error al reservar. Intentá de nuevo.' });
    }
  };

  const handlePay = async () => {
    dispatch({ type: 'SET_PAYING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: '' });
    try {
      const paid = await confirmDeposit(deposit.id, turn.manageToken);
      dispatch({ type: 'DONE', turn, deposit: paid });
    } catch (e) {
      dispatch({ type: 'SET_PAYING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: e.message || 'No se pudo procesar la seña. Intentá de nuevo.' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-cream to-paper p-6 pt-16">
      <div className="w-full max-w-lg">
        {step === STEPS.PROFESSIONAL && (
          loading ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-md">
              <p className="text-sm text-gray-400">Cargando...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-md">
              <p className="mb-4 text-sm text-red-500">{error}</p>
              <button onClick={() => navigate('/kiosko')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Volver al inicio
              </button>
            </div>
          ) : (
            <ProfessionalStep
              professionals={professionals}
              selectedProfessional={selectedProfessional}
              onSelect={(p) => dispatch({ type: 'SELECT_PROFESSIONAL', payload: p })}
              onBack={() => navigate('/kiosko')}
            />
          )
        )}

        {step === STEPS.DATE && (
          <CalendarStep
            workingDays={workingDays}
            selectedDate={selectedDate}
            onSelect={(date) => dispatch({ type: 'SELECT_DATE', payload: date })}
            onBack={() => dispatch({ type: 'BACK_TO_PROFESSIONAL' })}
          />
        )}

        {step === STEPS.SLOT && (
          <SlotStep
            date={selectedDate}
            slots={availableSlots}
            selectedSlot={selectedSlot}
            onSelect={(slot) => dispatch({ type: 'SELECT_SLOT', payload: slot })}
            onNext={() => dispatch({ type: 'NEXT_FORM' })}
            onBack={() => dispatch({ type: 'BACK_TO_DATE' })}
            error={error}
            slotsLoading={slotsLoading}
          />
        )}

        {step === STEPS.FORM && (
          <FormStep
            name={name}
            email={email}
            phone={phone}
            date={selectedDate}
            time={selectedSlot}
            professionalName={selectedProfessional?.name}
            onChange={(field, value) => dispatch({ type: 'SET_FIELD', field, value })}
            onSubmit={handleConfirm}
            onBack={() => dispatch({ type: 'BACK_TO_SLOT' })}
            loading={loading}
            error={error}
          />
        )}

        {step === STEPS.CHECKOUT && (
          <CheckoutStep
            deposit={deposit}
            professionalName={selectedProfessional?.name}
            date={selectedDate}
            time={selectedSlot}
            onPay={handlePay}
            onBack={() => dispatch({ type: 'BACK_TO_FORM' })}
            paying={paying}
            error={error}
          />
        )}

        {step === STEPS.DONE && (
          <DoneStep
            turn={turn}
            deposit={deposit}
            professionalName={selectedProfessional?.name}
            onNew={() => navigate('/kiosko/reservar', { replace: true })}
            onHome={() => navigate('/kiosko')}
          />
        )}
      </div>
    </div>
  );
}
