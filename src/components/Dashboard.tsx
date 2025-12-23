import React from "react";
import { AppState, DailyEntry } from "../types";
import {
  calculateDayStats,
  minutesToTime,
  calculatePresenceInPeriod,
  formatDateISO,
  getSWConfigForDate,
} from "../utils/calculations";
import { LIMITS } from "../utils/constants";
import { Briefcase, Calendar, Clock, Coffee, CheckCircle } from "lucide-react";

interface Props {
  state: AppState;
  currentMonth: Date;
  onUpdatePaidHours: (month: string, minutes: number) => void;
}

const Dashboard: React.FC<Props> = ({
  state,
  currentMonth,
  onUpdatePaidHours,
}) => {
  const entries = Object.values(state.entries) as DailyEntry[];
  const monthKey = `${currentMonth.getFullYear()}-${(
    currentMonth.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}`;

  let totalWorked = 0;
  let totalTarget = 0;
  let totalBP = 0;
  let swCountMonth = 0;
  let l104CountMonth = 0;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const swConfig = getSWConfigForDate(currentMonth, state.settings.swConfigs);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = formatDateISO(date);
    const entry = state.entries[dateStr];
    const stats = calculateDayStats(
      date,
      entry,
      state.settings,
      state.dayOverrides
    );

    totalWorked += stats.workedMinutes;
    totalTarget += stats.targetMinutes;
    if (stats.buonoPasto) totalBP++;

    if (entry) {
      if (entry.causal === "Smart") swCountMonth++;
      if (entry.causal === "104") l104CountMonth++;
    }
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);
  const annualPresenceDays = calculatePresenceInPeriod(
    startOfYear,
    endOfYear,
    state.entries,
    state.settings,
    state.dayOverrides
  );

  const paidMinutes = state.paidHours[monthKey] || 0;
  const currentMonthDelta = totalWorked - totalTarget - paidMinutes;

  let globalBank = state.settings.bankHoursInitial;
  Object.keys(state.entries).forEach((dateKey) => {
    const entry = state.entries[dateKey];
    const stats = calculateDayStats(
      new Date(dateKey),
      entry,
      state.settings,
      state.dayOverrides
    );
    globalBank += stats.workedMinutes - stats.targetMinutes;
  });

  Object.values(state.paidHours).forEach(
    (pm: any) => (globalBank -= Number(pm || 0))
  );

  const yearStr = currentMonth.getFullYear().toString();
  const yearEntries = entries.filter((e) => e.date.startsWith(yearStr));
  const usedFerie = yearEntries.filter((e) => e.causal === "Ferie").length;
  const remainingFerie = Math.floor(
    28 + state.settings.initialFerie - usedFerie
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
          <Clock size={80} />
        </div>
        <div className="flex items-center gap-2 mb-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
          <Clock size={16} /> Banca Ore
        </div>
        <div className="text-3xl font-black">{minutesToTime(globalBank)}</div>
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] text-slate-400 font-bold">
            Residuo Mese: {minutesToTime(currentMonthDelta)}
          </span>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">
              Ore Pagate (mese):
            </span>
            <input
              type="time"
              value={
                Math.floor(paidMinutes / 60)
                  .toString()
                  .padStart(2, "0") +
                ":" +
                (paidMinutes % 60).toString().padStart(2, "0")
              }
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                onUpdatePaidHours(monthKey, (h || 0) * 60 + (m || 0));
              }}
              className="bg-slate-800 text-white text-[10px] p-1.5 rounded-xl border border-slate-700 outline-none w-20 text-center font-black"
            />
          </div>
        </div>
      </div>

      <StatCard
        icon={<CheckCircle className="text-blue-500" />}
        label="Giorni Presenza (Anno)"
        value={annualPresenceDays.toFixed(2)}
        subtext={`Lavorati effettivi nel ${year}`}
      />
      <StatCard
        icon={<Calendar className="text-indigo-500" />}
        label="Ferie Residue"
        value={`${remainingFerie} gg`}
        subtext="28 + Iniziali - Godute"
      />
      <StatCard
        icon={<Briefcase className="text-emerald-500" />}
        label="Smart Working"
        value={`${swCountMonth}/${swConfig.limit}`}
        subtext={`Regola attiva: ${swConfig.limit} gg`}
        alert={swCountMonth > swConfig.limit}
      />

      <div className="col-span-full flex flex-wrap gap-3 mt-2">
        <SmallStat
          label="Art.25"
          current={yearEntries.filter((e) => e.causal === "Art.25").length}
          max={LIMITS.ART25_YEAR_MAX}
        />
        <SmallStat
          label="Art.26"
          current={yearEntries.filter((e) => e.causal === "Art.26").length}
          max={LIMITS.ART26_YEAR_MAX}
        />
        <SmallStat
          label="Fest. Sopp."
          current={yearEntries.filter((e) => e.causal === "FS").length}
          max={LIMITS.FS_YEAR_MAX}
        />
        <SmallStat
          label="PESA"
          current={yearEntries.filter((e) => e.causal === "PESA").length}
          max={LIMITS.PESA_YEAR_MAX}
        />
        <div className="px-4 py-2 rounded-2xl border border-slate-100 bg-orange-50/30 flex items-center gap-2">
          <Coffee size={14} className="text-orange-400" />
          <span className="text-xs font-black text-slate-700">
            {totalBP} Buoni Pasto (Mese)
          </span>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  alert?: boolean;
}> = ({ icon, label, value, subtext, alert }) => (
  <div
    className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${
      alert
        ? "border-red-500 ring-4 ring-red-50"
        : "border-slate-100 hover:shadow-md"
    }`}
  >
    <div className="flex items-center gap-3 mb-3">
      <div className="p-3 bg-slate-50 rounded-2xl">{icon}</div>
      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
        {label}
      </span>
    </div>
    <div className={`text-2xl font-black text-slate-900`}>{value}</div>
    <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
      {subtext}
    </div>
  </div>
);

const SmallStat: React.FC<{ label: string; current: number; max: number }> = ({
  label,
  current,
  max,
}) => (
  <div
    className={`px-4 py-2 rounded-2xl border flex items-center gap-3 ${
      current > max ? "bg-red-50 border-red-200" : "bg-white border-slate-100"
    }`}
  >
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {label}
    </span>
    <span
      className={`text-sm font-black ${
        current > max ? "text-red-600" : "text-slate-800"
      }`}
    >
      {current} / {max}
    </span>
  </div>
);

export default Dashboard;
