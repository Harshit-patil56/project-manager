import { useMemo } from "react";
import { format, differenceInDays, startOfDay, addDays, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";

const STATUS_COLORS = {
    TODO: "bg-zinc-400 dark:bg-zinc-500",
    IN_PROGRESS: "bg-blue-500",
    DONE: "bg-emerald-500",
};

const PRIORITY_BORDER = {
    HIGH: "border-l-red-500",
    MEDIUM: "border-l-amber-400",
    LOW: "border-l-zinc-400",
};

export default function ProjectTimeline({ tasks }) {
    const validTasks = useMemo(
        () =>
            tasks
                .filter((t) => !t.deletedAt && t.dueDate)
                .map((t) => ({
                    ...t,
                    start: t.startDate ? startOfDay(new Date(t.startDate)) : startOfDay(new Date(t.dueDate)),
                    end: startOfDay(new Date(t.dueDate)),
                }))
                .filter((t) => isValid(t.start) && isValid(t.end)),
        [tasks],
    );

    const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
        if (validTasks.length === 0) {
            const today = startOfDay(new Date());
            return { rangeStart: today, rangeEnd: addDays(today, 30), totalDays: 30 };
        }
        const allDates = validTasks.flatMap((t) => [t.start, t.end]);
        const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
        const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
        const start = addDays(min, -3);
        const end = addDays(max, 3);
        const total = differenceInDays(end, start) || 1;
        return { rangeStart: start, rangeEnd: end, totalDays: total };
    }, [validTasks]);

    const toPercent = (date) => {
        const days = differenceInDays(date, rangeStart);
        return Math.min(100, Math.max(0, (days / totalDays) * 100));
    };

    const todayPct = toPercent(startOfDay(new Date()));

    const headerMonths = useMemo(() => {
        const months = [];
        let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
        while (cur <= rangeEnd) {
            const pct = toPercent(cur);
            months.push({ label: format(cur, "MMM yyyy"), pct });
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        }
        return months;
    }, [rangeStart, rangeEnd, totalDays]);

    if (validTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <CalendarIcon className="size-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400">No tasks with dates to display.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Add start or due dates to tasks to see them here.</p>
            </div>
        );
    }

    const sorted = [...validTasks].sort((a, b) => a.start - b.start);

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Timeline</h3>

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="min-w-[600px]">
                    {/* Month header */}
                    <div className="relative h-8 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                        {headerMonths.map((m) => (
                            <span
                                key={m.label}
                                className="absolute top-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium"
                                style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}
                            >
                                {m.label}
                            </span>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {sorted.map((task) => {
                            const leftPct = toPercent(task.start);
                            const rightPct = toPercent(task.end);
                            const widthPct = Math.max(rightPct - leftPct, 0.5);
                            const barColor = STATUS_COLORS[task.status] ?? "bg-zinc-400";
                            const borderColor = PRIORITY_BORDER[task.priority] ?? "border-l-zinc-400";

                            return (
                                <div key={task.id} className="flex items-center min-h-[40px] hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                                    {/* Label */}
                                    <div className="w-48 flex-shrink-0 px-3 py-1">
                                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{task.title}</p>
                                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                            {task.projectSlug ? `${task.projectSlug?.toUpperCase()}-${task.taskNumber}` : ""}
                                        </p>
                                    </div>

                                    {/* Bar area */}
                                    <div className="flex-1 relative h-10 px-2 flex items-center">
                                        {/* Today line */}
                                        {todayPct >= 0 && todayPct <= 100 && (
                                            <div
                                                className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10"
                                                style={{ left: `${todayPct}%` }}
                                            />
                                        )}
                                        <div
                                            className={`absolute h-5 rounded-full ${barColor} border-l-2 ${borderColor} opacity-90 hover:opacity-100 transition-opacity cursor-default`}
                                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "6px" }}
                                            title={`${task.title}\n${format(task.start, "MMM d")} → ${format(task.end, "MMM d")}`}
                                        />
                                    </div>

                                    {/* Dates */}
                                    <div className="w-28 flex-shrink-0 px-2 text-right">
                                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                            {task.startDate ? `${format(task.start, "MMM d")} → ` : ""}{format(task.end, "MMM d")}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                    <span key={status} className="flex items-center gap-1.5">
                        <span className={`inline-block size-2.5 rounded-full ${color}`} />
                        {status.replace("_", " ")}
                    </span>
                ))}
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-px h-3 bg-red-400" />
                    Today
                </span>
            </div>
        </div>
    );
}
