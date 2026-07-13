import { useEffect, useState } from 'react';
import {
  getConfig,
  updateConfig,
  getWorkBands,
  createWorkBand,
  deleteWorkBand,
} from '../../api/admin';

const DURATION_PRESETS = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: null, label: 'Personalizado' },
];

// ── Duration Section ──────────────────────────────────────────────────────────

function DurationSection() {
  const [duration, setDuration] = useState(30);
  const [customValue, setCustomValue] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    getConfig().then((cfg) => {
      const preset = DURATION_PRESETS.find((p) => p.value === cfg.turnDuration);
      if (preset && preset.value !== null) {
        setDuration(cfg.turnDuration);
        setIsCustom(false);
      } else {
        setIsCustom(true);
        setCustomValue(String(cfg.turnDuration));
      }
    });
  }, []);

  const handlePresetChange = (preset) => {
    if (preset.value === null) {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      setDuration(preset.value);
    }
  };

  const handleSave = async () => {
    const finalDuration = isCustom ? parseInt(customValue, 10) : duration;
    if (!finalDuration || finalDuration < 5 || finalDuration > 480) {
      setFeedback({ type: 'error', msg: 'El valor debe estar entre 5 y 480 minutos.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateConfig({ turnDuration: finalDuration });
      setFeedback({ type: 'success', msg: 'Guardado correctamente.' });
    } catch {
      setFeedback({ type: 'error', msg: 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedValue = isCustom ? null : duration;

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Duración de turno</h2>
      <p className="mb-5 text-sm text-gray-500">
        Tiempo por defecto asignado a cada turno.
      </p>

      <div className="flex flex-wrap gap-3">
        {DURATION_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetChange(preset)}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              selectedValue === preset.value
                ? 'border-brick bg-cream text-brick'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={480}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Ej: 45"
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
          <span className="text-sm text-gray-500">minutos</span>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brick px-5 py-2 text-sm font-medium text-white hover:bg-brick-dark disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {feedback && (
          <span
            className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-500'}`}
          >
            {feedback.msg}
          </span>
        )}
      </div>
    </section>
  );
}

// ── Working Days Section ──────────────────────────────────────────────────────

const WEEK_DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

function WorkingDaysSection() {
  const [selected, setSelected] = useState([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    getConfig().then((cfg) => {
      if (Array.isArray(cfg.workingDays)) setSelected(cfg.workingDays);
    });
  }, []);

  const toggle = (value) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      setFeedback({ type: 'error', msg: 'Seleccioná al menos un día.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateConfig({ workingDays: selected });
      setFeedback({ type: 'success', msg: 'Guardado correctamente.' });
    } catch {
      setFeedback({ type: 'error', msg: 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Días de atención</h2>
      <p className="mb-5 text-sm text-gray-500">
        Seleccioná los días de la semana en que se aceptan turnos.
      </p>

      <div className="flex gap-2">
        {WEEK_DAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            className={`flex h-10 w-12 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
              selected.includes(day.value)
                ? 'border-brick bg-cream text-brick'
                : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brick px-5 py-2 text-sm font-medium text-white hover:bg-brick-dark disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {feedback && (
          <span className={`text-sm ${feedback.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {feedback.msg}
          </span>
        )}
      </div>
    </section>
  );
}

// ── Work Bands Section ────────────────────────────────────────────────────────

function WorkBandsSection() {
  const [bands, setBands] = useState([]);
  const [form, setForm] = useState({ label: '', startTime: '', endTime: '' });
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => getWorkBands().then(setBands);

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.startTime || !form.endTime) {
      setFormError('Completá hora de inicio y fin.');
      return;
    }
    if (form.startTime >= form.endTime) {
      setFormError('La hora de fin debe ser mayor que la de inicio.');
      return;
    }

    setAdding(true);
    try {
      await createWorkBand({
        label: form.label || undefined,
        startTime: form.startTime,
        endTime: form.endTime,
        sortOrder: bands.length,
      });
      setForm({ label: '', startTime: '', endTime: '' });
      load();
    } catch {
      setFormError('Error al crear la banda.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteWorkBand(id);
    load();
  };

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Bandas horarias</h2>
      <p className="mb-5 text-sm text-gray-500">
        Definí los rangos de atención del día. Podés agregar más de una banda.
      </p>

      {/* Band list */}
      {bands.length === 0 ? (
        <p className="mb-5 text-sm text-gray-400">Sin bandas configuradas.</p>
      ) : (
        <ul className="mb-5 space-y-2">
          {bands.map((band) => (
            <li
              key={band.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div>
                <span className="text-sm font-medium text-gray-800">
                  {band.startTime} — {band.endTime}
                </span>
                {band.label && (
                  <span className="ml-2 text-xs text-gray-500">({band.label})</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(band.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add band form */}
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Etiqueta</label>
          <input
            type="text"
            placeholder="Mañana"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Inicio</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Fin</label>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brick focus:ring-2 focus:ring-brass"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-brick px-4 py-2 text-sm font-medium text-white hover:bg-brick-dark disabled:opacity-60"
        >
          {adding ? 'Agregando...' : 'Agregar'}
        </button>
      </form>

      {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-800">Configuración</h1>
      <div className="flex max-w-2xl flex-col gap-5">
        <DurationSection />
        <WorkingDaysSection />
        <WorkBandsSection />
      </div>
    </div>
  );
}
