import React, { useState, useRef } from "react";
import { AppState, DailyEntry } from "../types";
import { isHoliday, formatDateISO, parseISOLocal } from "../utils/calculations";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Upload,
  ShieldCheck,
  AlertCircle,
  Trash2,
  MapPinOff,
  FileSpreadsheet,
} from "lucide-react";

const USER_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-yellow-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
];

const BORDER_COLORS = [
  "border-blue-200",
  "border-emerald-200",
  "border-indigo-200",
  "border-orange-200",
  "border-pink-200",
  "border-cyan-200",
  "border-yellow-200",
  "border-rose-200",
  "border-violet-200",
  "border-teal-200",
];

interface ValidationError {
  date: string;
  message: string;
}

export const AdminView: React.FC = () => {
  const [importedUsers, setImportedUsers] = useState<AppState[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [auditPerformed, setAuditPerformed] = useState(false);

  const [selectedValMonth, setSelectedValMonth] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.getMonth();
  });
  const [selectedValYear, setSelectedValYear] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.getFullYear();
  });

  const [validationRange, setValidationRange] = useState<"month" | "quarter">(
    "month"
  );
  const [anomalies, setAnomalies] = useState<ValidationError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as AppState;
          if (data.settings && data.entries) {
            setImportedUsers((prev) => {
              if (
                prev.find((u) => u.settings.userName === data.settings.userName)
              )
                return prev;
              return [...prev, data].slice(0, 10);
            });
          }
        } catch (err) {
          console.error("Invalid JSON", err);
        }
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAuditPerformed(false);
  };

  const validatePresences = () => {
    const newAnomalies: ValidationError[] = [];
    const startDate = new Date(selectedValYear, selectedValMonth, 1, 12, 0, 0);

    setCurrentMonth(new Date(selectedValYear, selectedValMonth, 1));

    let totalDays = 0;
    if (validationRange === "month") {
      totalDays = new Date(selectedValYear, selectedValMonth + 1, 0).getDate();
    } else {
      const endOfQuarter = new Date(selectedValYear, selectedValMonth + 3, 0);
      const diffTime = Math.abs(endOfQuarter.getTime() - startDate.getTime());
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // AUDIT: Controllo solo copertura ufficio
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = formatDateISO(d);

      const patronSaint = importedUsers[0]?.settings.patronSaintDate;
      const holiday = isHoliday(d, patronSaint);
      const isWkEnd = d.getDay() === 0 || d.getDay() === 6;

      if (isWkEnd || holiday) continue;

      const anyInOffice = importedUsers.some((u) => {
        const entry = u.entries[dateStr];
        return !entry || entry.causal === "Ufficio";
      });

      if (!anyInOffice) {
        newAnomalies.push({
          date: dateStr,
          message: "Ufficio Vuoto: nessun operatore presente fisicamente",
        });
      }
    }

    setAnomalies(newAnomalies);
    setAuditPerformed(true);
  };

  const exportToExcel = () => {
    if (importedUsers.length === 0) return;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const italianDays = [
      "Domenica",
      "Lunedì",
      "Martedì",
      "Mercoledì",
      "Giovedì",
      "Venerdì",
      "Sabato",
    ];

    // Header 1: Servizio Stipendi + Giorni della settimana
    let csvContent = "Servizio Stipendi Pensioni";
    for (let d = 1; d <= 31; d++) {
      if (d <= daysInMonth) {
        const date = new Date(year, month, d);
        csvContent += `;${italianDays[date.getDay()]}`;
      } else {
        csvContent += ";";
      }
    }
    csvContent += "\n";

    // Header 2: Vuoto + Numeri giorni
    csvContent += "";
    for (let d = 1; d <= 31; d++) {
      csvContent += `;${d}`;
    }
    csvContent += "\n";

    // Data Rows
    importedUsers.forEach((user) => {
      let row = `${user.settings.userName || "Utente"}`;
      for (let d = 1; d <= 31; d++) {
        if (d <= daysInMonth) {
          const date = new Date(year, month, d);
          const dateStr = formatDateISO(date);
          const holiday = isHoliday(date, user.settings.patronSaintDate);
          const isWkEnd = date.getDay() === 0 || date.getDay() === 6;

          if (holiday || isWkEnd) {
            row += ";";
          } else {
            const entry = user.entries[dateStr];
            if (!entry || entry.causal === "Ufficio") {
              row += ";P";
            } else if (entry.causal === "Smart") {
              row += ";SW";
            } else {
              row += ";AG";
            }
          }
        } else {
          row += ";";
        }
      }
      csvContent += row + "\n";
    });

    // Create and download file
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Prospetto_Presenze_${year}_${month + 1}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();
  const firstDayDate = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const firstDayDay = firstDayDate.getDay();
  const offset = firstDayDay === 0 ? 6 : firstDayDay - 1;
  const monthName = currentMonth.toLocaleString("it-IT", {
    month: "long",
    year: "numeric",
  });

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven"];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER CONTROLLI */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-5">
          <div className="p-5 bg-slate-900 rounded-2xl text-white shadow-2xl shadow-slate-200 transform -rotate-2">
            <ShieldCheck size={36} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">
              Audit Team
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Verifica presidio fisico ufficio
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-50 p-4 rounded-[2rem] border border-slate-200">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
              Inizio Audit
            </label>
            <div className="flex gap-2">
              <select
                value={selectedValMonth}
                onChange={(e) => setSelectedValMonth(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(0, i).toLocaleString("it-IT", { month: "long" })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={selectedValYear}
                onChange={(e) => setSelectedValYear(Number(e.target.value))}
                className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
              Range
            </label>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setValidationRange("month")}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  validationRange === "month"
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-400"
                }`}
              >
                Mese
              </button>
              <button
                onClick={() => setValidationRange("quarter")}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  validationRange === "quarter"
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-400"
                }`}
              >
                Trimestre
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 rounded-2xl hover:bg-slate-100 transition-all font-black uppercase text-[10px] tracking-widest border border-slate-200 shadow-sm"
            >
              <Upload size={16} /> Importa Team
            </button>
            <button
              onClick={validatePresences}
              className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95"
            >
              <ShieldCheck size={18} /> Esegui Audit
            </button>
            {auditPerformed && (
              <button
                onClick={exportToExcel}
                disabled={anomalies.length > 0}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 
                  ${
                    anomalies.length > 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
              >
                <FileSpreadsheet size={18} /> Esporta Excel
              </button>
            )}
          </div>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".json"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 flex items-center justify-between">
              Membri Team{" "}
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                {importedUsers.length}
              </span>
            </h3>
            <div className="space-y-2">
              {importedUsers.map((user, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${USER_COLORS[idx]}`}
                    ></div>
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                      {user.settings.userName || "Utente"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setImportedUsers((u) => u.filter((_, i) => i !== idx))
                    }
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {importedUsers.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 text-center py-4">
                  Nessun file importato
                </p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500" /> Anomalie
              Copertura
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {auditPerformed && anomalies.length === 0 && (
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-center py-4">
                  Copertura ufficio OK
                </p>
              )}
              {anomalies.map((error, i) => (
                <div
                  key={i}
                  className="flex flex-col p-4 rounded-2xl border border-red-100 bg-red-50 text-red-700 animate-in slide-in-from-left-2 duration-300"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MapPinOff size={14} />
                    <span className="text-[10px] font-black uppercase">
                      Assenza Presidio
                    </span>
                  </div>
                  <span className="text-[10px] font-black">
                    {parseISOLocal(error.date).toLocaleDateString("it-IT", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <p className="text-[9px] font-bold mt-2 uppercase leading-relaxed">
                    {error.message}
                  </p>
                </div>
              ))}
              {!auditPerformed && importedUsers.length > 0 && (
                <p className="text-[10px] font-bold text-slate-400 text-center py-4 uppercase tracking-widest">
                  Premi "Esegui Audit" per iniziare
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CALENDARIO */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-8 border-b border-slate-50 bg-slate-50/20">
            <h2 className="text-3xl font-black text-slate-800 capitalize tracking-tight">
              {monthName}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                      1
                    )
                  )
                }
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                      1
                    )
                  )
                }
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 bg-slate-50/50 text-center py-3 border-b border-slate-100">
            {weekDays.map((d) => (
              <div
                key={d}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5">
            {Array.from({ length: offset }).map((_, i) => (
              <div
                key={`off-${i}`}
                className="bg-slate-50/10 border border-slate-50 h-[170px]"
              ></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                i + 1,
                12,
                0,
                0
              );
              if (d.getDay() === 0 || d.getDay() === 6) return null;
              const dateStr = formatDateISO(d);

              const isHolidayDay = isHoliday(
                d,
                importedUsers[0]?.settings.patronSaintDate
              );
              const coverageError = anomalies.find((a) => a.date === dateStr);

              return (
                <div
                  key={i}
                  className={`h-[170px] p-2 border relative flex flex-col transition-all 
                  ${isHolidayDay ? "bg-red-50/30 border-red-100" : "bg-white"}
                  ${
                    coverageError
                      ? "border-red-500 ring-2 ring-red-50 z-10"
                      : "border-slate-50"
                  }
                `}
                >
                  <div className="flex justify-between items-start mb-1.5 px-1">
                    <span
                      className={`text-sm font-black ${
                        isHolidayDay ? "text-red-400" : "text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {coverageError && (
                      <AlertCircle
                        size={14}
                        className="text-red-500 animate-pulse"
                      />
                    )}
                  </div>

                  <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
                    {!isHolidayDay &&
                      importedUsers.map((user, uIdx) => {
                        const entry = user.entries[dateStr];
                        const effectiveCausal = entry?.causal || "Ufficio";
                        const isOffice = effectiveCausal === "Ufficio";
                        return (
                          <div
                            key={uIdx}
                            className={`flex items-center gap-1.5 p-1 rounded-lg border transition-all ${
                              isOffice
                                ? `bg-white ${BORDER_COLORS[uIdx]} shadow-sm`
                                : "bg-slate-50 border-transparent opacity-50"
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${USER_COLORS[uIdx]}`}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-[8px] font-black uppercase truncate ${
                                  isOffice ? "text-slate-800" : "text-slate-400"
                                }`}
                              >
                                {user.settings.userName.slice(0, 10)}
                              </div>
                              <div
                                className={`text-[7px] font-bold uppercase truncate opacity-60`}
                              >
                                {effectiveCausal}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
