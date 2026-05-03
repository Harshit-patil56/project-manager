import { useEffect, useState } from "react";
import { Github, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiFetch } from "../lib/api";

export default function TaskCommits({ taskId }) {
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCommitIds, setNewCommitIds] = useState(new Set());

    useEffect(() => {
        if (!taskId) return;

        apiFetch(`/api/tasks/${taskId}/commits`)
            .then((data) => setCommits(data || []))
            .catch(() => {})
            .finally(() => setLoading(false));

        const es = new EventSource(`/api/tasks/${taskId}/commit-events`);
        es.onmessage = (e) => {
            try {
                const commit = JSON.parse(e.data);
                setCommits((prev) => [commit, ...prev]);
                setNewCommitIds((prev) => new Set([...prev, commit.id]));
                setTimeout(() => {
                    setNewCommitIds((prev) => {
                        const next = new Set(prev);
                        next.delete(commit.id);
                        return next;
                    });
                }, 5000);
            } catch { /* ignore */ }
        };

        return () => es.close();
    }, [taskId]);

    if (loading) return (
        <div className="text-sm text-zinc-500 dark:text-zinc-400 py-6 text-center">Loading commits...</div>
    );

    if (commits.length === 0) return (
        <div className="text-center py-10">
            <Github className="size-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No commits linked yet.</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Include the task key in a commit message to link it here.
            </p>
        </div>
    );

    return (
        <div className="space-y-3">
            {commits.map((commit) => (
                <div
                    key={commit.id}
                    className={`p-4 rounded-md border transition-all ${
                        newCommitIds.has(commit.id)
                            ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30"
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    }`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="flex-shrink-0 mt-0.5">
                                <Github className="size-4 text-zinc-500 dark:text-zinc-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                    {commit.message}
                                    {newCommitIds.has(commit.id) && (
                                        <span className="ml-2 inline-block px-1.5 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                            new
                                        </span>
                                    )}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
                                        {commit.sha}
                                    </code>
                                    <span>{commit.author}</span>
                                    <span>·</span>
                                    <span>{formatDistanceToNow(new Date(commit.pushedAt), { addSuffix: true })}</span>
                                </div>
                            </div>
                        </div>
                        <a
                            href={commit.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                            title="View on GitHub"
                        >
                            <ExternalLink className="size-3.5" />
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
