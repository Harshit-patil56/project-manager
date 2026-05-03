import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchTrashThunk, restoreWorkspaceThunk, restoreProjectThunk, restoreTaskThunk } from "../features/trashSlice";
import { fetchWorkspaces } from "../features/workspaceSlice";
import { Building2, FolderOpen, ListTodo, RotateCcw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

function daysLeft(deletedAt) {
    const daysElapsed = Math.floor((Date.now() - new Date(deletedAt)) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysElapsed);
}

function TrashItem({ name, subtitle, deletedAt, onRestore, canRestore }) {
    const days = daysLeft(deletedAt);
    return (
        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{name}</p>
                {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{subtitle}</p>}
                <p className={`text-xs mt-0.5 ${days <= 5 ? "text-red-500 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                    {days === 0 ? "Deletes very soon" : `${days} day${days !== 1 ? "s" : ""} remaining`}
                    {" · "}
                    Archived {formatDistanceToNow(new Date(deletedAt), { addSuffix: true })}
                </p>
            </div>
            {canRestore && (
                <button
                    onClick={onRestore}
                    className="ml-3 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex-shrink-0"
                >
                    <RotateCcw className="w-3 h-3" /> Restore
                </button>
            )}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, count }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{count}</span>
        </div>
    );
}

export default function Trash() {
    const dispatch = useDispatch();
    const { workspaces, projects, tasks, loading } = useSelector((state) => state.trash);
    const allWorkspaces = useSelector((state) => state.workspace.workspaces);

    useEffect(() => {
        dispatch(fetchTrashThunk());
    }, [dispatch]);

    const workspaceNameMap = useMemo(() => {
        const map = new Map();
        allWorkspaces.forEach((ws) => map.set(ws.id, ws.name));
        return map;
    }, [allWorkspaces]);

    const handleRestoreWorkspace = async (workspaceId) => {
        const loadingId = toast.loading("Restoring workspace...");
        try {
            await dispatch(restoreWorkspaceThunk(workspaceId)).unwrap();
            dispatch(fetchWorkspaces());
            toast.dismiss(loadingId);
            toast.success("Workspace restored!");
        } catch (err) {
            toast.dismiss(loadingId);
            toast.error(err?.message || "Failed to restore workspace");
        }
    };

    const handleRestoreProject = async (projectId) => {
        const loadingId = toast.loading("Restoring project...");
        try {
            await dispatch(restoreProjectThunk(projectId)).unwrap();
            dispatch(fetchWorkspaces());
            toast.dismiss(loadingId);
            toast.success("Project restored!");
        } catch (err) {
            toast.dismiss(loadingId);
            toast.error(err?.message || "Failed to restore project");
        }
    };

    const handleRestoreTask = async (taskId) => {
        const loadingId = toast.loading("Restoring task...");
        try {
            await dispatch(restoreTaskThunk(taskId)).unwrap();
            dispatch(fetchWorkspaces());
            toast.dismiss(loadingId);
            toast.success("Task restored!");
        } catch (err) {
            toast.dismiss(loadingId);
            toast.error(err?.message || "Failed to restore task");
        }
    };

    const isEmpty = workspaces.length === 0 && projects.length === 0 && tasks.length === 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/10">
                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Trash</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Items are permanently deleted after 30 days.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm">Loading...</div>
                ) : isEmpty ? (
                    <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        <Trash2 className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">Trash is empty</p>
                        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Archived items will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {workspaces.length > 0 && (
                            <div>
                                <SectionHeader icon={Building2} title="Workspaces" count={workspaces.length} />
                                <div className="space-y-2">
                                    {workspaces.map((ws) => (
                                        <TrashItem
                                            key={ws.id}
                                            name={ws.name}
                                            subtitle={ws.description}
                                            deletedAt={ws.deletedAt}
                                            canRestore={ws.userRole === "ADMIN"}
                                            onRestore={() => handleRestoreWorkspace(ws.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {projects.length > 0 && (
                            <div>
                                <SectionHeader icon={FolderOpen} title="Projects" count={projects.length} />
                                <div className="space-y-2">
                                    {projects.map((p) => (
                                        <TrashItem
                                            key={p.id}
                                            name={p.name}
                                            subtitle={workspaceNameMap.get(p.workspaceId) ? `In ${workspaceNameMap.get(p.workspaceId)}` : null}
                                            deletedAt={p.deletedAt}
                                            canRestore={true}
                                            onRestore={() => handleRestoreProject(p.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {tasks.length > 0 && (
                            <div>
                                <SectionHeader icon={ListTodo} title="Tasks" count={tasks.length} />
                                <div className="space-y-2">
                                    {tasks.map((t) => (
                                        <TrashItem
                                            key={t.id}
                                            name={t.title}
                                            subtitle={t.assignee?.name ? `Assigned to ${t.assignee.name}` : null}
                                            deletedAt={t.deletedAt}
                                            canRestore={true}
                                            onRestore={() => handleRestoreTask(t.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
