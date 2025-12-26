import React, { useState, useEffect, useMemo } from "react";
import { DailyEntry, Causal, UserSettings, AppState } from "../types";
import {
  getLongDayInfo,
  getTimeClassForDate,
  timeToMinutes,
  minutesToTime,
  formatDateISO,
  getWeekRange,
  isHoliday,
  parseISOLocal,
} from "../utils/calculations";
import { LIMITS } from "../utils/constants";
import {
  X,
  Save,
  Trash2,
  Clock,
  Zap,
  AlertTriangle,
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Info,
  Send,
} from "lucide-react";

interface Props {
  date: Date;
  entry?: DailyEntry;
  settings: UserSettings;
  state: AppState;
  onSave: (entry: DailyEntry) => void;
  onDelete: (date: string) => void;
  onSwap: (dateA: string, dateB: string) => void;
  onClose: () => void;
}

const causals: { label: string; value: Causal }[] = [
  { label: "Ufficio", value: "Ufficio" },
  { label: "Smart", value: "Smart" },
  { label: "Ferie", value: "Ferie" },
  { label: "Malattia", value: "Malattia" },
  { label: "Legge 104", value: "104" },
  { label: "Art.25", value: "Art.25" },
  { label: "Art.26", value: "Art.26" },
  { label: "Fest. Soppr.", value: "FS" },
  { label: "PSTU", value: "PSTU" },
  { label: "PESA", value: "PESA" },
];

const DayModal: React.FC<Props> = ({
  date,
  entry,
  settings,
  state,
  onSave,
  onDelete,
  onSwap,
  onClose,
}) => {
  const dateStr = formatDateISO(date);
  const yearStr = date.getFullYear().toString();
  const timeClass = getTimeClassForDate(date, settings.timeClassConfigs);
  const isLong =
    timeClass.type === "alternated" &&
    getLongDayInfo(date, settings.longDayConfigs, state.dayOverrides);

  const [causal, setCausal] = useState<Causal>(entry?.causal || "Ufficio");
  const [start, setStart] = useState(entry?.startTime || "07:30");
  const [end, setEnd] = useState(
    entry?.endTime || (isLong ? "17:00" : "13:30")
  );
  const [permesso, setPermesso] = useState(
    entry
      ? Math.floor(entry.permessoMinutes / 60)
          .toString()
          .padStart(2, "0") +
          ":" +
          (entry.permessoMinutes % 60).toString().padStart(2, "0")
      : "00:00"
  );
  const [notes, setNotes] = useState(entry?.notes || "");
  const [springRequest, setSpringRequest] = useState(
    entry?.springRequest || false
  );
  const [error, setError] = useState<string | null>(null);

  // Stato per lo scambio della lunga
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    if (!entry) {
      if (causal === "Smart" || causal === "Ufficio") {
        setEnd(isLong ? "17:00" : "13:30");
      }
      // Reset spring request if changing causal to Office/Smart
      if (causal === "Ufficio" || causal === "Smart") {
        setSpringRequest(false);
      }
    } else {
      // Se modifico un'entry esistente, se passo a Ufficio/Smart resetto spring
      if (causal === "Ufficio" || causal === "Smart") {
        setSpringRequest(false);
      }
    }
  }, [causal, isLong, entry]);

  const actualStart = Math.max(timeToMinutes(start), timeToMinutes("07:30"));
  const expectedExit = minutesToTime(actualStart + (isLong ? 570 : 360))
    .replace(/h |m/g, ":")
    .replace(/ :/, ":")
    .slice(0, 5);

  const checkYearlyLimits = (newCausal: Causal) => {
    const yearEntries = (Object.values(state.entries) as DailyEntry[]).filter(
      (e) => e.date.startsWith(yearStr) && e.date !== dateStr
    );
    const count = yearEntries.filter((e) => e.causal === newCausal).length;

    if (newCausal === "Art.25" && count >= LIMITS.ART25_YEAR_MAX)
      return `Limite annuo Art. 25 raggiunto (${LIMITS.ART25_YEAR_MAX}).`;
    if (newCausal === "Art.26" && count >= LIMITS.ART26_YEAR_MAX)
      return `Limite annuo Art. 26 raggiunto (${LIMITS.ART26_YEAR_MAX}).`;
    if (newCausal === "PESA" && count >= LIMITS.PESA_YEAR_MAX)
      return `Limite annuo PESA raggiunto (${LIMITS.PESA_YEAR_MAX}).`;
    if (newCausal === "FS" && count >= LIMITS.FS_YEAR_MAX)
      return `Limite annuo Festività Soppresse raggiunto (${LIMITS.FS_YEAR_MAX}).`;

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startMin = timeToMinutes(start);

    if (
      startMin < timeToMinutes("07:00") ||
      startMin > timeToMinutes("12:00")
    ) {
      setError("L'orario di ingresso deve essere tra le 07:00 e le 12:00.");
      return;
    }

    const limitError = checkYearlyLimits(causal);
    if (limitError) {
      setError(limitError);
      return;
    }

    const [ph, pm] = permesso.split(":").map(Number);
    onSave({
      date: dateStr,
      causal,
      startTime: start,
      endTime: end,
      permessoMinutes: (ph || 0) * 60 + (pm || 0),
      notes,
      springRequest:
        causal !== "Ufficio" && causal !== "Smart" ? springRequest : false,
    });
  };

  // Calcolo dei giorni candidati per lo scambio
  const candidateDays = useMemo(() => {
    if (!isLong || timeClass.type !== "alternated") return [];

    const { start: weekStart, end: weekEnd } = getWeekRange(date);
    const candidates: { date: string; label: string }[] = [];

    let current = new Date(weekStart);
    while (current <= weekEnd) {
      const cStr = formatDateISO(current);
      const isCandidateLong = getLongDayInfo(
        current,
        settings.longDayConfigs,
        state.dayOverrides
      );
      const isCandHoliday = isHoliday(current, settings.patronSaintDate);
      const isCandWeekend = current.getDay() === 0 || current.getDay() === 6;
      const isFriday = current.getDay() === 5;

      // Vincoli: stessa settimana, stesso mese, non lungo, non festa, non weekend, diverso da oggi, NON VENERDÌ
      if (
        current.getMonth() === date.getMonth() &&
        !isCandidateLong &&
        !isCandHoliday &&
        !isCandWeekend &&
        !isFriday &&
        cStr !== dateStr
      ) {
        candidates.push({
          date: cStr,
          label: current.toLocaleDateString("it-IT", {
            weekday: "short",
            day: "numeric",
          }),
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return candidates;
  }, [date, isLong, timeClass, settings, state.dayOverrides, dateStr]);

  const handleSwapAction = (targetDate: string) => {
    onSwap(dateStr, targetDate);
    setIsSwapping(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-2xl text-white">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                Gestione Giornata
              </h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                {date.toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-slate-200 rounded-2xl text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* CONTENT - SCROLLABLE ON MOBILE, GRID ON PC */}
        <div className="overflow-y-auto p-0 flex-1">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col lg:flex-row h-full"
          >
            {/* LEFT COLUMN: Configurazione e Causali */}
            <div className="flex-1 p-8 lg:border-r border-slate-100 space-y-8">
              {/* Alert area */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-tight animate-in slide-in-from-top-2">
                  <AlertTriangle size={20} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Sezione Long Day / Swap */}
              {isLong && timeClass.type === "alternated" && (
                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-[2rem] shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                        <CalendarIcon size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                          Turno di Lunga
                        </h4>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase">
                          Obiettivo: 9h lavorative
                        </p>
                      </div>
                    </div>
                    {!isSwapping ? (
                      <button
                        type="button"
                        onClick={() => setIsSwapping(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 rounded-xl border border-indigo-200 text-[10px] font-black uppercase hover:shadow-md transition-all active:scale-95"
                      >
                        <ArrowRightLeft size={14} /> Sposta Lunga
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsSwapping(false)}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 px-2"
                      >
                        Chiudi
                      </button>
                    )}
                  </div>

                  {isSwapping && (
                    <div className="mt-5 pt-5 border-t border-indigo-200/50 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-start gap-2 mb-4 bg-white/50 p-3 rounded-2xl border border-indigo-100">
                        <Info
                          size={14}
                          className="text-indigo-400 shrink-0 mt-0.5"
                        />
                        <p className="text-[9px] font-bold text-indigo-800 uppercase leading-relaxed">
                          Scegli un giorno di "corta" della stessa
                          settimana/mese. <br />
                          <span className="text-red-500 font-black">
                            Nota:
                          </span>{" "}
                          Non è possibile scambiare con il Venerdì.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {candidateDays.length > 0 ? (
                          candidateDays.map((c) => (
                            <button
                              key={c.date}
                              type="button"
                              onClick={() => handleSwapAction(c.date)}
                              className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                              {c.label}
                            </button>
                          ))
                        ) : (
                          <div className="w-full p-4 text-center bg-white/50 rounded-2xl border border-dashed border-indigo-200">
                            <p className="text-[10px] font-bold text-red-400 uppercase italic">
                              Nessun giorno disponibile (stessa sett./mese e no
                              Ven)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selezione Causali */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-500 rounded-full"></div>{" "}
                  Causale Giornaliera
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  {causals.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setCausal(c.value);
                        setError(null);
                      }}
                      className={`px-4 py-4 rounded-2xl text-[10px] font-black transition-all border uppercase tracking-wider text-left relative overflow-hidden group
                        ${
                          causal === c.value
                            ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-slate-50"
                        }
                      `}
                    >
                      <span className="relative z-10">{c.label}</span>
                      {causal === c.value && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Orari, Permessi e Note */}
            <div className="flex-1 p-8 bg-slate-50/30 space-y-8">
              {(causal === "Ufficio" || causal === "Smart") && (
                <div className="space-y-6">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>{" "}
                    Orari di Lavoro
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                        Ingresso
                      </label>
                      <input
                        type="time"
                        value={start}
                        onChange={(e) => {
                          setStart(e.target.value);
                          setError(null);
                        }}
                        className="w-full bg-transparent text-xl font-black outline-none text-slate-800"
                      />
                    </div>
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                        Uscita
                      </label>
                      <input
                        type="time"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="w-full bg-transparent text-xl font-black outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-blue-700 bg-blue-100/50 px-5 py-4 rounded-[1.5rem] border border-blue-200/50 text-xs font-bold shadow-sm">
                    <Zap size={18} className="shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase opacity-60">
                        Fine turno ottimale
                      </span>
                      <span className="text-sm font-black tracking-tight">
                        Per coprire il target suggeriamo le {expectedExit}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SWITCH SPRING (Solo se non Ufficio/Smart) */}
              {causal !== "Ufficio" && causal !== "Smart" && (
                <div className="space-y-6">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>{" "}
                    Richiesta Gestionale
                  </label>
                  <div
                    onClick={() => setSpringRequest(!springRequest)}
                    className={`cursor-pointer p-4 rounded-3xl border transition-all flex items-center justify-between group
                      ${
                        springRequest
                          ? "bg-white border-indigo-200 shadow-md"
                          : "bg-white/50 border-slate-200 hover:bg-white"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-2xl transition-colors ${
                          springRequest
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Send size={18} />
                      </div>
                      <div>
                        <div
                          className={`text-xs font-black uppercase tracking-wide ${
                            springRequest ? "text-indigo-900" : "text-slate-500"
                          }`}
                        >
                          Richiesto su Spring
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">
                          Segnala l'avvenuta richiesta ufficiale
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                        springRequest
                          ? "bg-indigo-600 justify-end"
                          : "bg-slate-200 justify-start"
                      }`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <div className="w-1 h-3 bg-orange-400 rounded-full"></div>{" "}
                  Dettagli Extra
                </label>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                    Recupero / Permesso (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={permesso}
                    onChange={(e) => setPermesso(e.target.value)}
                    className="w-full bg-transparent text-lg font-black outline-none text-slate-800"
                  />
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                    Note Professionali
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Aggiungi dettagli sulla giornata..."
                    className="w-full bg-transparent border-none font-medium outline-none resize-none text-sm text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* ACTION BAR (Fixed on Mobile, part of columns on PC) */}
            <div className="lg:hidden shrink-0 p-6 bg-white border-t border-slate-100 flex gap-4">
              {entry && (
                <button
                  type="button"
                  onClick={() => onDelete(dateStr)}
                  className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors font-black uppercase text-xs tracking-widest border border-red-100 active:scale-95"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all font-black uppercase text-xs tracking-widest shadow-xl active:scale-95"
              >
                <Save size={20} />
                Salva
              </button>
            </div>
          </form>
        </div>

        {/* PC FOOTER ACTION BAR */}
        <div className="hidden lg:flex shrink-0 p-6 bg-white border-t border-slate-100 justify-between items-center px-10">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Time Class:{" "}
            <span className="text-slate-800">
              {timeClass.type === "alternated" ? "Alternata" : "Flat"}
            </span>
            {isLong && " • Lunga"}
          </div>
          <div className="flex gap-4">
            {entry && (
              <button
                type="button"
                onClick={() => onDelete(dateStr)}
                className="flex items-center gap-2 px-6 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-black uppercase text-xs tracking-widest active:scale-95"
              >
                <Trash2 size={18} /> Elimina
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95"
            >
              <Save size={20} />
              Conferma e Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayModal;
