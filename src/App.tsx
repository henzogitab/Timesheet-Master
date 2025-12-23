import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Calendar from "./components/Calendar";
import DayModal from "./components/DayModal";
import Settings from "./components/Settings";
import { AdminView } from "./components/AdminView";
import { AppState, DailyEntry, UserSettings } from "./types";
import { formatDateISO } from "./utils/calculations";
import { Clock, LayoutDashboard, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "timesheet_master_v3_it";

const DEFAULT_SETTINGS: UserSettings = {
  userName: "",
  initialFerie: 0,
  monthlyFerieAccrual: 2.16,
  bankHoursInitial: 0,
  patronSaintDate: "09-04",
  longDayConfigs: [{ startDate: "2020-01-01", days: [1, 4] }],
  swConfigs: [{ startDate: "2020-01-01", limit: 8 }],
  timeClassConfigs: [{ startDate: "2020-01-01", type: "alternated" }],
};

const App: React.FC = () => {
  const [view, setView] = useState<"personal" | "admin">("personal");
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved)
      return {
        entries: {},
        settings: DEFAULT_SETTINGS,
        paidHours: {},
        dayOverrides: {},
      };
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...parsed.settings,
        swConfigs: parsed.settings.swConfigs || DEFAULT_SETTINGS.swConfigs,
        timeClassConfigs:
          parsed.settings.timeClassConfigs || DEFAULT_SETTINGS.timeClassConfigs,
        initialFerie: parsed.settings.initialFerie || 0,
        patronSaintDate: parsed.settings.patronSaintDate || "09-04",
      },
      dayOverrides: parsed.dayOverrides || {},
    };
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleSaveEntry = (entry: DailyEntry) => {
    setState((prev) => ({
      ...prev,
      entries: { ...prev.entries, [entry.date]: entry },
    }));
    setSelectedDate(null);
  };

  const handleDeleteEntry = (date: string) => {
    setState((prev) => {
      const newEntries = { ...prev.entries };
      delete newEntries[date];

      const newOverrides = { ...(prev.dayOverrides || {}) };
      delete newOverrides[date];

      return { ...prev, entries: newEntries, dayOverrides: newOverrides };
    });
    setSelectedDate(null);
  };

  const handleSwapDays = (dateA: string, dateB: string) => {
    setState((prev) => {
      const overrides = { ...(prev.dayOverrides || {}) };

      // Lo scambio: il giorno A (lungo) diventa CORTO, il giorno B (corto) diventa LUNGO.
      // Se c'erano già degli override, li invertiamo o li settiamo.
      overrides[dateA] = "short";
      overrides[dateB] = "long";

      return { ...prev, dayOverrides: overrides };
    });
  };

  const handleUpdateSettings = (settings: UserSettings) => {
    setState((prev) => ({ ...prev, settings }));
  };

  const handleUpdatePaidHours = (month: string, minutes: number) => {
    setState((prev) => ({
      ...prev,
      paidHours: { ...prev.paidHours, [month]: Number(minutes) },
    }));
  };

  const handleImport = (importedState: AppState) => {
    const mergedState = {
      ...importedState,
      settings: {
        ...DEFAULT_SETTINGS,
        ...importedState.settings,
        swConfigs:
          importedState.settings.swConfigs || DEFAULT_SETTINGS.swConfigs,
        timeClassConfigs:
          importedState.settings.timeClassConfigs ||
          DEFAULT_SETTINGS.timeClassConfigs,
        patronSaintDate: importedState.settings.patronSaintDate || "09-04",
      },
      dayOverrides: importedState.dayOverrides || {},
    };
    setState(mergedState);
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans antialiased text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-2xl shadow-slate-200">
              <Clock size={28} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight tracking-tight uppercase">
                Timesheet Pro
              </h1>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">
                {view === "admin"
                  ? "Area Amministrazione"
                  : "Gestione Personale"}
              </p>
            </div>
          </div>
          <nav className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setView("personal")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                view === "personal"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LayoutDashboard size={16} /> Personale
            </button>
            <button
              onClick={() => setView("admin")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                view === "admin"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <ShieldCheck size={16} /> Admin
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 mt-10">
        {view === "personal" ? (
          <>
            <Dashboard
              state={state}
              currentMonth={currentMonth}
              onUpdatePaidHours={handleUpdatePaidHours}
            />
            <Calendar
              state={state}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onDayClick={setSelectedDate}
            />
            <Settings
              settings={state.settings}
              onUpdateSettings={handleUpdateSettings}
              allData={state}
              onImport={handleImport}
            />
          </>
        ) : (
          <AdminView />
        )}
      </main>
      {selectedDate && (
        <DayModal
          date={selectedDate}
          entry={state.entries[formatDateISO(selectedDate)]}
          settings={state.settings}
          state={state}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          onSwap={handleSwapDays}
          onClose={() => setSelectedDate(null)}
        />
      )}
      <footer className="max-w-6xl mx-auto px-6 text-center mt-12 py-8 border-t border-slate-200">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Timesheet Master &bull; Italian Labor Compliance v4.8
        </p>
      </footer>
    </div>
  );
};

export default App;
