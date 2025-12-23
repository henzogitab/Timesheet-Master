import React, { useRef, useState, useMemo } from "react";
import {
  UserSettings,
  AppState,
  DailyEntry,
  SWLimit,
  TimeClassType,
} from "../types";
import {
  isHoliday,
  getDefaultEntry,
  formatDateISO,
  getTimeClassForDate,
  validateState,
  parseISOLocal,
} from "../utils/calculations";
import { LIMITS } from "../utils/constants";
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Plus,
  Trash2,
  Calendar,
  User,
  Briefcase,
  Clock,
  Type,
  AlertTriangle,
} from "lucide-react";

interface Props {
  settings: UserSettings;
  onUpdateSettings: (s: UserSettings) => void;
  allData: AppState;
  onImport: (data: AppState) => void;
}

const Settings: React.FC<Props> = ({
  settings,
  onUpdateSettings,
  allData,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newLongDay, setNewLongDay] = useState<{
    date: string;
    days: number[];
  }>({ date: "", days: [] });
  const [newSW, setNewSW] = useState<{ date: string; limit: SWLimit }>({
    date: "",
    limit: 8,
  });
  const [newTimeClass, setNewTimeClass] = useState<{
    date: string;
    type: TimeClassType;
  }>({ date: "", type: "alternated" });

  // Stato per l'export granulare
  const [exportRange, setExportRange] = useState<"all" | "month" | "quarter">(
    "all"
  );
  const [exportMonth, setExportMonth] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.getMonth() + 1;
  });
  const [exportYear, setExportYear] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.getFullYear();
  });

  const activeTimeClass = getTimeClassForDate(
    new Date(),
    settings.timeClassConfigs
  );

  // LOGICA DI SICUREZZA EXPORT
  const hasGlobalErrors = useMemo(() => {
    // FIX: Explicitly cast Object.values results to DailyEntry[] to resolve 'unknown' property access errors.
    const entries = Object.values(allData.entries) as DailyEntry[];
    if (entries.length === 0) return false;

    // 1. Verifica errori puntuali (Smart Working e limiti settimanali)
    for (const dateStr of Object.keys(allData.entries)) {
      if (validateState(parseISOLocal(dateStr), allData).length > 0)
        return true;
    }

    // 2. Verifica limiti annui e ferie
    const years = Array.from(new Set(entries.map((e) => e.date.split("-")[0])));
    for (const year of years) {
      const yearEntries = entries.filter((e) => e.date.startsWith(year));

      if (
        yearEntries.filter((e) => e.causal === "Art.25").length >
        LIMITS.ART25_YEAR_MAX
      )
        return true;
      if (
        yearEntries.filter((e) => e.causal === "Art.26").length >
        LIMITS.ART26_YEAR_MAX
      )
        return true;
      if (
        yearEntries.filter((e) => e.causal === "FS").length > LIMITS.FS_YEAR_MAX
      )
        return true;
      if (
        yearEntries.filter((e) => e.causal === "PESA").length >
        LIMITS.PESA_YEAR_MAX
      )
        return true;

      const usedFerie = yearEntries.filter((e) => e.causal === "Ferie").length;
      const totalFerieLimit = 28 + settings.initialFerie;
      if (usedFerie > totalFerieLimit) return true;
    }

    return false;
  }, [allData, settings]);

  const formatInitialBank = (minutes: number) => {
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const parseInitialBank = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const handleExport = () => {
    if (hasGlobalErrors) return;

    let entriesToExport = { ...allData.entries };

    if (exportRange !== "all") {
      const prefixes: string[] = [];
      if (exportRange === "month") {
        prefixes.push(
          `${exportYear}-${exportMonth.toString().padStart(2, "0")}`
        );
      } else {
        for (let i = 0; i < 3; i++) {
          const d = new Date(exportYear, exportMonth - 1 + i, 1);
          prefixes.push(
            `${d.getFullYear()}-${(d.getMonth() + 1)
              .toString()
              .padStart(2, "0")}`
          );
        }
      }

      entriesToExport = Object.fromEntries(
        Object.entries(allData.entries).filter(([date]) =>
          prefixes.some((p) => date.startsWith(p))
        )
      );
    }

    const exportPayload: AppState = { ...allData, entries: entriesToExport };
    const dataStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffix =
      exportRange === "all"
        ? "full"
        : exportRange === "month"
        ? `month_${exportYear}_${exportMonth}`
        : `quarter_${exportYear}_${exportMonth}`;
    link.download = `timesheet_${settings.userName || "user"}_${suffix}.json`;
    link.click();
  };

  const addTimeClassConfig = () => {
    if (!newTimeClass.date) return;
    const updated = [
      ...settings.timeClassConfigs,
      { startDate: newTimeClass.date, type: newTimeClass.type },
    ];
    onUpdateSettings({ ...settings, timeClassConfigs: updated });
    setNewTimeClass({ date: "", type: "alternated" });
  };

  const addLongDayConfig = () => {
    if (!newLongDay.date || newLongDay.days.length === 0) return;
    const updated = [
      ...settings.longDayConfigs,
      { startDate: newLongDay.date, days: newLongDay.days },
    ];
    onUpdateSettings({ ...settings, longDayConfigs: updated });
    setNewLongDay({ date: "", days: [] });
  };

  const addSWConfig = () => {
    if (!newSW.date) return;
    const updated = [
      ...settings.swConfigs,
      { startDate: newSW.date, limit: newSW.limit },
    ];
    onUpdateSettings({ ...settings, swConfigs: updated });
    setNewSW({ date: "", limit: 8 });
  };

  const removeSWConfig = (index: number) => {
    const updated = settings.swConfigs.filter((_, i) => i !== index);
    onUpdateSettings({ ...settings, swConfigs: updated });
  };

  const toggleDaySelection = (day: number) => {
    setNewLongDay((prev) => {
      const isSelected = prev.days.includes(day);
      if (isSelected) {
        return { ...prev, days: prev.days.filter((d) => d !== day) };
      } else {
        if (prev.days.length >= 2) return prev;
        return { ...prev, days: [...prev.days, day] };
      }
    });
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mt-12 mb-12">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon size={28} className="text-slate-400" />
        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
          Configurazione Utente
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* COLONNA 1: PROFILO E SW */}
        <div className="space-y-10">
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
              <User size={14} /> Profilo e Ferie
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                  Nome Operatore
                </label>
                <input
                  type="text"
                  value={settings.userName}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, userName: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl font-bold outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                    Ferie Iniziali (gg)
                  </label>
                  <input
                    type="number"
                    value={settings.initialFerie}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        initialFerie: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                    Santo Patrono (MM-DD)
                  </label>
                  <input
                    type="text"
                    placeholder="09-04"
                    value={settings.patronSaintDate}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        patronSaintDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl font-bold outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                    Banca Ore Iniz. (HH:mm)
                  </label>
                  <input
                    type="text"
                    value={formatInitialBank(settings.bankHoursInitial)}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        bankHoursInitial: parseInitialBank(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl font-bold outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
              <Briefcase size={14} /> Regole Smart Working
            </h3>
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newSW.date}
                  onChange={(e) => setNewSW({ ...newSW, date: e.target.value })}
                  className="px-3 py-2 text-xs border rounded-xl font-bold"
                />
                <select
                  value={newSW.limit}
                  onChange={(e) =>
                    setNewSW({
                      ...newSW,
                      limit: Number(e.target.value) as SWLimit,
                    })
                  }
                  className="px-3 py-2 text-xs border rounded-xl font-bold bg-white"
                >
                  <option value={6}>6 Giorni</option>
                  <option value={8}>8 Giorni</option>
                  <option value={10}>10 Giorni</option>
                </select>
              </div>
              <button
                onClick={addSWConfig}
                className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-black uppercase tracking-widest transition-all"
              >
                Aggiungi Regola SW
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {settings.swConfigs.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl"
                >
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">
                    {c.startDate}:{" "}
                    <span className="text-blue-600">{c.limit} gg</span>
                  </span>
                  {settings.swConfigs.length > 1 && (
                    <button
                      onClick={() => removeSWConfig(idx)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLONNA 2: CLASSI ORARIO E LUNGHE */}
        <div className="space-y-10">
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
              <Type size={14} /> Regole Classe Orario
            </h3>
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newTimeClass.date}
                  onChange={(e) =>
                    setNewTimeClass({ ...newTimeClass, date: e.target.value })
                  }
                  className="px-3 py-2 text-xs border rounded-xl font-bold"
                />
                <select
                  value={newTimeClass.type}
                  onChange={(e) =>
                    setNewTimeClass({
                      ...newTimeClass,
                      type: e.target.value as TimeClassType,
                    })
                  }
                  className="px-3 py-2 text-xs border rounded-xl font-bold bg-white"
                >
                  <option value="alternated">Alternato</option>
                  <option value="flat">Flat (7h 12m)</option>
                </select>
              </div>
              <button
                onClick={addTimeClassConfig}
                className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-black uppercase tracking-widest transition-all"
              >
                Aggiungi Regola Classe
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {settings.timeClassConfigs.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl"
                >
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">
                    {c.startDate}:{" "}
                    <span className="text-indigo-600 font-black">
                      {c.type === "flat" ? "FLAT" : "ALTERNATO"}
                    </span>
                  </span>
                  {settings.timeClassConfigs.length > 1 && (
                    <button
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          timeClassConfigs: settings.timeClassConfigs.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {activeTimeClass.type === "alternated" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                <Clock size={14} /> Giorni di Lunga (Max 2)
              </h3>
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-4">
                <div className="space-y-2">
                  <input
                    type="date"
                    value={newLongDay.date}
                    onChange={(e) =>
                      setNewLongDay({ ...newLongDay, date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border rounded-xl font-bold"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDaySelection(d)}
                        className={`px-3 py-1.5 text-[9px] font-black rounded-lg border transition-all ${
                          newLongDay.days.includes(d)
                            ? "bg-blue-600 text-white border-blue-600 shadow-md"
                            : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][d]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={addLongDayConfig}
                    className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-black uppercase tracking-widest transition-all"
                  >
                    Applica Giornate Lunghe
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {settings.longDayConfigs.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl"
                  >
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">
                      {c.startDate}:{" "}
                      {c.days
                        .map(
                          (d) =>
                            ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][d]
                        )
                        .join(", ")}
                    </span>
                    <button
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          longDayConfigs: settings.longDayConfigs.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLONNA 3: BACKUP E EXPORT */}
        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
            <Download size={14} /> Export e Backup
          </h3>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase">
                Range Esportazione
              </label>
              <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {(["all", "month", "quarter"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setExportRange(r)}
                    className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                      exportRange === r
                        ? "bg-slate-900 text-white"
                        : "text-slate-400"
                    }`}
                  >
                    {r === "all" ? "Tutto" : r === "month" ? "Mese" : "Trim."}
                  </button>
                ))}
              </div>
            </div>

            {exportRange !== "all" && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95">
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(Number(e.target.value))}
                  className="p-2 border rounded-xl text-[10px] font-bold outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString("it-IT", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="p-2 border rounded-xl text-[10px] font-bold outline-none"
                />
              </div>
            )}

            <div className="relative group">
              <button
                onClick={handleExport}
                disabled={hasGlobalErrors}
                className={`w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black rounded-xl transition-all shadow-lg 
                  ${
                    hasGlobalErrors
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                      : "bg-slate-900 text-white hover:bg-black"
                  }`}
              >
                <Download size={14} /> Esporta JSON
              </button>

              {hasGlobalErrors && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-red-600 text-white text-[9px] font-black uppercase rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center leading-relaxed z-50">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <AlertTriangle size={12} />
                    <span>Esportazione Bloccata</span>
                  </div>
                  Risolvi prima i conflitti nel calendario (errori smart, ferie
                  o limiti annui superati) per poter esportare i dati.
                </div>
              )}
            </div>

            <div className="relative pt-4 border-t border-slate-200">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-500 text-[10px] font-black rounded-xl hover:border-slate-300"
              >
                <Upload size={14} /> Importa Backup
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    onImport(JSON.parse(ev.target?.result as string));
                  reader.readAsText(file);
                }}
                className="hidden"
                accept=".json"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
