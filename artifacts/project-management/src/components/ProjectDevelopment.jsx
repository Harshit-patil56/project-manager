import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Github, ExternalLink, Search, LayoutList, Rows3, GitBranch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiFetch } from "../lib/api";

export default function ProjectDevelopment({ project, tasks }) {
    const navigate = useNavigate();
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [taskFilter, setTaskFilter] = useState("all");
    const [grouped, setGrouped] = useState(false);

    useEffect(() => {
        if (!project?.id) return;
        setLoading(true);
        apiFetch(`/api/projects/${project.id}/commits`)
            .then((data) => setCommits(data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [project?.id]);

    const filtered = useMemo(() => {
        return commits.filter((c) => {
            const matchesSearch = !search || c.message.toLowerCase().includes(search.toLowerCase());
            const matchesTask = taskFilter === "all" || c.taskId === taskFilter;
            return matchesSearch && matchesTask;
        });
    }, [commits, search, taskFilter]);

    const goToTask = (commit) => {
        navigate(`/task-details?projectId=${project.id}&taskId=${commit.taskId}`);
    };

    const CommitRow = ({ commit }) => (
        <div
            onClick={() => goToTask(commit)}
            className="group flex items-start justify-between gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-all"
        >
            <div className="flex items-start gap-3 min-w-0">
                <Github className="size-4 text-zinc-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {commit.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {commit.sha}
                        </code>
                        {commit.branch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ddf4ff] dark:bg-[#1f3044] text-[#0969da] dark:text-[#79c0ff] border border-[#54aeff66] dark:border-[#388bfd66] font-mono text-xs">
                                <GitBranch className="size-3 flex-shrink-0" />
                                {commit.branch}
                            </span>
                        )}
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{commit.author}</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">·</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            {formatDistanceToNow(new Date(commit.pushedAt), { addSuffix: true })}
                        </span>
                        {commit.task && (
                            <>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">·</span>
                                <span className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                    {project?.slug}-{commit.task.taskNumber}
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-40">
                                    {commit.task.title}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <a
                href={commit.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition"
                title="View on GitHub"
            >
                <ExternalLink className="size-3.5" />
            </a>
        </div>
    );

    const GroupedView = () => {
        const byTask = useMemo(() => {
            const map = new Map();
            for (const c of filtered) {
                const key = c.taskId;
                if (!map.has(key)) map.set(key, { task: c.task, commits: [] });
                map.get(key).commits.push(c);
            }
            return [...map.values()];
        }, [filtered]);

        if (byTask.length === 0) return <Empty />;

        return (
            <div className="space-y-6">
                {byTask.map(({ task, commits: taskCommits }) => (
                    <div key={task?.id}>
                        <div
                            className="flex items-center gap-2 mb-3 cursor-pointer group"
                            onClick={() => navigate(`/task-details?projectId=${project.id}&taskId=${task?.id}`)}
                        >
                            <span className="px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                {project?.slug}-{task?.taskNumber}
                            </span>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {task?.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                                {taskCommits.length} commit{taskCommits.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div className="space-y-2 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                            {taskCommits.map((c) => <CommitRow key={c.id} commit={c} />)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const Empty = () => (
        <div className="text-center py-16">
            <Github className="size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No commits found</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                {commits.length === 0
                    ? "Link a GitHub repo in Settings and push commits with task keys to see them here."
                    : "Try adjusting your search or filter."}
            </p>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search commit messages..."
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <select
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="all">All tasks</option>
                    {tasks.filter((t) => commits.some((c) => c.taskId === t.id)).map((t) => (
                        <option key={t.id} value={t.id}>
                            {project?.slug}-{t.taskNumber} · {t.title}
                        </option>
                    ))}
                </select>

                <div className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
                    <button
                        onClick={() => setGrouped(false)}
                        title="Flat list"
                        className={`p-1.5 rounded transition ${!grouped ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
                    >
                        <LayoutList className="size-3.5" />
                    </button>
                    <button
                        onClick={() => setGrouped(true)}
                        title="Group by task"
                        className={`p-1.5 rounded transition ${grouped ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
                    >
                        <Rows3 className="size-3.5" />
                    </button>
                </div>

                {(search || taskFilter !== "all") && (
                    <button
                        onClick={() => { setSearch(""); setTaskFilter("all"); }}
                        className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Count */}
            {!loading && commits.length > 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {filtered.length} of {commits.length} commit{commits.length !== 1 ? "s" : ""}
                </p>
            )}

            {/* Content */}
            {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-10 text-center">Loading commits...</div>
            ) : grouped ? (
                <GroupedView />
            ) : filtered.length === 0 ? (
                <Empty />
            ) : (
                <div className="space-y-2">
                    {filtered.map((c) => <CommitRow key={c.id} commit={c} />)}
                </div>
            )}
        </div>
    );
}
