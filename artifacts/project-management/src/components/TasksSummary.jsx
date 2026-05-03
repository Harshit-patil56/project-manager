import { useEffect, useState } from "react";
import { ArrowRight, ArrowUp, Clock, AlertTriangle, User } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";

export default function TasksSummary() {

    const navigate = useNavigate();
    const { user } = useUser();
    const { currentWorkspace } = useSelector((state) => state.workspace);
    const [tasks, setTasks] = useState([]);
    const [expanded, setExpanded] = useState({});

    useEffect(() => {
        if (currentWorkspace) {
            setTasks(currentWorkspace.projects.flatMap((project) => project.tasks || []));
        }
    }, [currentWorkspace]);

    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE');
    const myTasks = tasks.filter(t => t.assigneeId === user?.id && t.status !== 'DONE');
    const inProgressIssues = tasks.filter(i => i.status === 'IN_PROGRESS');

    const summaryCards = [
        {
            title: "My Tasks",
            count: myTasks.length,
            icon: User,
            color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
            allItems: myTasks,
        },
        {
            title: "Overdue",
            count: overdueTasks.length,
            icon: AlertTriangle,
            color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
            allItems: overdueTasks,
        },
        {
            title: "In Progress",
            count: inProgressIssues.length,
            icon: Clock,
            color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
            allItems: inProgressIssues,
        }
    ];

    const toggleExpand = (title) => {
        setExpanded(prev => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <div className="space-y-6">
            {summaryCards.map((card) => {
                const isExpanded = !!expanded[card.title];
                const visibleItems = isExpanded ? card.allItems : card.allItems.slice(0, 3);
                const hiddenCount = card.count - 3;

                return (
                    <div key={card.title} className="bg-white dark:bg-zinc-950 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 rounded-lg overflow-hidden">
                        <div className="border-b border-zinc-200 dark:border-zinc-800 p-4 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                                    <card.icon className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                                </div>
                                <div className="flex items-center justify-between flex-1">
                                    <h3 className="text-sm font-medium text-gray-800 dark:text-white">{card.title}</h3>
                                    <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${card.color}`}>
                                        {card.count}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            {visibleItems.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-4">
                                    No {card.title.toLowerCase()}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {visibleItems.map((issue) => (
                                        <div key={issue.id} onClick={() => navigate(`/taskDetails?projectId=${issue.projectId}&taskId=${issue.id}`)} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                                            <h4 className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                                {issue.title}
                                            </h4>
                                            <p className="text-xs text-gray-600 dark:text-zinc-400 capitalize mt-1">
                                                {issue.type} • {issue.priority} priority
                                            </p>
                                        </div>
                                    ))}
                                    {!isExpanded && hiddenCount > 0 && (
                                        <button
                                            onClick={() => toggleExpand(card.title)}
                                            className="flex items-center justify-center w-full text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white mt-2 transition-colors"
                                        >
                                            View {hiddenCount} more <ArrowRight className="w-3 h-3 ml-2" />
                                        </button>
                                    )}
                                    {isExpanded && card.count > 3 && (
                                        <button
                                            onClick={() => toggleExpand(card.title)}
                                            className="flex items-center justify-center w-full text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white mt-2 transition-colors"
                                        >
                                            Show less <ArrowUp className="w-3 h-3 ml-2" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
