import React from "react";
import { AppState, DailyEntry } from "../types";
import {
  calculateDayStats,
  isHoliday,
  validateState,
  minutesToTime,
  formatDateISO,
} from "../utils/calculations";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MessageSquareText,
} from "lucide-react";

interface Props {
  state: AppState;
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  onDayClick: (d: Date) => void;
}

const Calendar: React.FC<Props> = ({
  state,
  currentMonth,
  onMonthChange,
  onDayClick,
}) => {
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
  const offset = firstDayDay === 0 || firstDayDay === 6 ? 0 : firstDayDay - 1;

  const prevMonth = () =>
    onMonthChange(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  const nextMonth = () =>
    onMonthChange(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );

  const monthName = currentMonth.toLocaleString("it-IT", {
    month: "long",
    year: "numeric",
  });

  const getTileStyle = (causal?: string, holiday?: boolean) => {
    if (holiday || causal === "Festa")
      return "bg-red-50 hover:bg-red-100 cursor-default";
    switch (causal) {
      case "Smart":
        return "bg-green-50 hover:bg-green-100";
      case "Ferie":
      case "FS":
        return "bg-green-100 hover:bg-green-200"; // Verde più scuro dello smart
      case "104":
      case "Art.25":
      case "PSTU":
      case "PESA":
        return "bg-blue-50 hover:bg-blue-100"; // Stesso stile 104 (azzurro chiaro)
      case "Malattia":
      case "Art.26":
        return "bg-red-50 hover:bg-red-100"; // Stile rosso chiaro
      case "Ufficio":
        return "bg-white hover:bg-slate-50";
      default:
        return "bg-white hover:bg-slate-50";
    }
  };

  const getBadgeStyle = (causal?: string) => {
    switch (causal) {
      case "Smart":
      case "Ferie":
      case "FS":
        return "text-green-700 bg-green-200/50";
      case "104":
      case "Art.25":
      case "PSTU":
      case "PESA":
        return "text-blue-700 bg-blue-200/50";
      case "Malattia":
      case "Art.26":
        return "text-rose-700 bg-rose-200/50";
      case "Ufficio":
        return "text-slate-600 bg-slate-200/50 border border-slate-300 shadow-sm";
      default:
        return "text-slate-600 bg-slate-200/50";
    }
  };

  const renderDay = (day: number) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      12,
      0,
      0
    );
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) return null;

    const dateStr = formatDateISO(date);
    const entry = state.entries[dateStr];
    const holiday = isHoliday(date, state.settings.patronSaintDate);
    const stats = calculateDayStats(
      date,
      entry,
      state.settings,
      state.dayOverrides
    );
    const errors = validateState(date, state);

    // Priorità: entry manuale -> se festivo allora Festa -> altrimenti Ufficio
    const effectiveCausal = entry?.causal || (holiday ? "Festa" : "Ufficio");
    const displayTag =
      effectiveCausal !== "Weekend" && effectiveCausal !== "Festa"
        ? effectiveCausal
        : undefined;
    const isInert = holiday || effectiveCausal === "Festa";

    const badgeStyle = getBadgeStyle(effectiveCausal);

    return (
      <div
        key={day}
        onClick={() => !isInert && onDayClick(date)}
        className={`group min-h-[110px] p-2 border border-slate-100 transition-all relative flex flex-col
          ${getTileStyle(effectiveCausal, holiday)}
          cursor-pointer overflow-visible z-0 hover:z-20
        `}
      >
        <div className="flex justify-between items-start">
          <span
            className={`text-sm font-bold ${
              holiday || effectiveCausal === "Festa"
                ? "text-red-500"
                : "text-slate-600"
            }`}
          >
            {day}
          </span>

          <div className="flex items-center gap-1 absolute top-2 right-2">
            {state.dayOverrides && state.dayOverrides[dateStr] && (
              <div className="text-[7px] font-black text-indigo-500 bg-indigo-50 px-1 rounded border border-indigo-200">
                SCAMBIO
              </div>
            )}

            {/* Icona Nota: aumentata dimensione e rimossa logica tooltip locale */}
            {entry?.notes && (
              <MessageSquareText
                size={20}
                className="text-slate-400 fill-slate-100"
              />
            )}

            {errors.length > 0 && (
              <div className="relative group/error z-20">
                <AlertCircle size={16} className="text-red-600 animate-pulse" />
                <div className="hidden group-hover/error:block absolute right-0 top-5 w-48 bg-red-600 text-white text-[10px] p-2 rounded shadow-xl pointer-events-none z-50">
                  {errors.map((err, idx) => (
                    <p
                      key={idx}
                      className="mb-1 last:mb-0 border-b border-red-400 pb-1 last:border-0"
                    >
                      • {err}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {displayTag && (
          <div className="mt-1 space-y-1">
            <div
              className={`text-[9px] px-1.5 py-0.5 rounded-full inline-block font-extrabold uppercase truncate max-w-full ${badgeStyle}`}
            >
              {displayTag === "FS" ? "Festività Sopp." : displayTag}
            </div>

            {/* SPRING BADGE */}
            {entry?.springRequest &&
              effectiveCausal !== "Ufficio" &&
              effectiveCausal !== "Smart" && (
                <div
                  className={`text-[7px] px-1.5 py-0.5 rounded-full inline-block font-black uppercase truncate max-w-full ml-1 border border-current opacity-80 ${badgeStyle}`}
                >
                  SPRING
                </div>
              )}

            {displayTag !== "PSTU" &&
              displayTag !== "Ferie" &&
              displayTag !== "Malattia" &&
              displayTag !== "Art.25" &&
              displayTag !== "Art.26" &&
              displayTag !== "FS" &&
              displayTag !== "PESA" &&
              stats?.workedMinutes !== undefined &&
              stats.workedMinutes > 0 && (
                <div className="text-[10px] font-bold text-slate-500">
                  {minutesToTime(stats.workedMinutes)}
                </div>
              )}

            {stats?.buonoPasto && (
              <div
                className="w-2 h-2 rounded-full bg-orange-400 absolute bottom-2 right-2 shadow-sm"
                title="Buono Pasto"
              ></div>
            )}
          </div>
        )}

        {(holiday || effectiveCausal === "Festa") && (
          <span className="text-[9px] text-red-600 font-black mt-auto uppercase italic">
            Festa
          </span>
        )}

        {/* TOOLTIP NOTA: Visibile su hover intero tile (group-hover) */}
        {entry?.notes && (
          <div className="hidden group-hover:block absolute right-2 top-9 z-[60] w-48 bg-slate-800 text-white text-[10px] p-3 rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200 border border-slate-700">
            <p className="font-bold border-b border-slate-600 pb-1 mb-1 uppercase tracking-wider text-[9px] flex items-center gap-2">
              <MessageSquareText size={12} /> Nota
            </p>
            <p className="leading-relaxed">{entry.notes}</p>
          </div>
        )}
      </div>
    );
  };

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven"];

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-2xl font-black text-slate-800 capitalize tracking-tight">
          {monthName}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-slate-100"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextMonth}
            className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-slate-100"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 border-b border-slate-100 bg-slate-50/30">
        {weekDays.map((d) => (
          <div
            key={d}
            className="py-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5">
        {Array.from({ length: offset }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="bg-slate-50/30 border border-slate-100/50 min-h-[110px]"
          ></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => renderDay(i + 1))}
      </div>
    </div>
  );
};

export default Calendar;
