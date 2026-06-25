import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { getAnalytics } from '../../api/admin';

const pct = (n) => `${Math.round((n ?? 0) * 100)}%`;
const money = (n) => `$${(n ?? 0).toLocaleString('es-AR')}`;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const monthLabel = (m) => {
  const [, mm] = (m || '').split('-');
  return MONTHS[Number(mm) - 1] ?? m;
};

function KpiCard({ label, value, sub, accent = 'text-gray-900' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-black ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAnalytics()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudo cargar la analítica.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Cargando analítica…</div>;
  }
  if (error) {
    return <div className="p-8 text-sm text-red-500">{error}</div>;
  }

  const { noShow, reminders, revenue, conversion, occupancy, timeseries } = data;

  if (!noShow || !reminders || !revenue || !conversion) {
    return <div className="p-8 text-sm text-red-500">Datos de analítica incompletos.</div>;
  }

  const noShowData = [
    { name: 'Antes', tasa: Math.round(noShow.antes.rate * 100) },
    { name: 'Después', tasa: Math.round(noShow.despues.rate * 100) },
  ];
  const seriesData = (timeseries || []).map((t) => ({
    mes: monthLabel(t.month),
    Reservas: t.bookings,
    Ausencias: t.noShow,
  }));
  const occData = (occupancy || []).map((o) => ({
    name: o.name,
    Total: o.total,
    Completados: o.completed,
  }));

  const noShowDrop = Math.round((noShow.antes.rate - noShow.despues.rate) * 100);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Impacto del sistema de reservas con seña + recordatorio por WhatsApp.
          Corte de lanzamiento: {data.launchDate}.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ausentismo (antes → después)"
          value={`${pct(noShow.antes.rate)} → ${pct(noShow.despues.rate)}`}
          sub={`${noShowDrop} puntos menos de no-shows`}
          accent="text-green-600"
        />
        <KpiCard
          label="Confirman por WhatsApp"
          value={pct(reminders.responseRate)}
          sub={`${reminders.confirmed} de ${reminders.sent} recordatorios`}
          accent="text-blue-600"
        />
        <KpiCard
          label="Cobrado en señas"
          value={money(revenue.totalAmount)}
          sub={`${revenue.depositsPaid} señas pagadas`}
          accent="text-gray-900"
        />
        <KpiCard
          label="Clientes recurrentes"
          value={pct(conversion.repeatRate)}
          sub={`${conversion.repeatCustomers} de ${conversion.uniqueCustomers} clientes volvieron`}
          accent="text-indigo-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tasa de ausentismo: antes vs. después del sistema">
          <BarChart data={noShowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis unit="%" tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="tasa" radius={[6, 6, 0, 0]}>
              <Cell fill="#ef4444" />
              <Cell fill="#22c55e" />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Ocupación por peluquero">
          <BarChart data={occData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Total" fill="#93c5fd" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Completados" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Reservas y ausencias por mes">
            <LineChart data={seriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Reservas" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Ausencias" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
