import { format } from "date-fns";
import toast from "react-hot-toast";
import { useAuth } from "@clerk/react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarIcon, MessageCircle, GitCommit, PenIcon } from "lucide-react";
import { addCommentThunk } from "../features/workspaceSlice";
import { apiFetch } from "../lib/api";
import TaskCommits from "../components/TaskCommits";

const TaskDetails = () => {
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    const dispatch = useDispatch();
    const { userId } = useAuth();
    const [task, setTask] = useState(null);
    const [project, setProject] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("discussion");
    const [hasNewCommit, setHasNewCommit] = useState(false);

    const { currentWorkspace } = useSelector((state) => state.workspace);

    const fetchComments = async () => {
        if (!taskId) return;
        try {
            const data = await apiFetch(`/api/tasks/${taskId}/comments`);
            setComments(data || []);
        } catch { /* silent */ }
    };

    const fetchTaskDetails = async () => {
        setLoading(true);
        if (!projectId || !taskId) return;
        try {
            if (currentWorkspace) {
                const proj = currentWorkspace.projects.find((p) => p.id === projectId);
                if (proj) {
                    const tsk = proj.tasks.find((t) => t.id === taskId);
                    if (tsk) {
                        setTask(tsk);
                        setProject(proj);
                        setLoading(false);
                        return;
                    }
                }
            }
            const [tsk, proj] = await Promise.all([
                apiFetch(`/api/tasks/${taskId}`),
                apiFetch(`/api/projects/${projectId}`),
            ]);
            setTask(tsk);
            setProject(proj);
        } catch (err) {
            toast.error("Failed to load task details");
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            const result = await dispatch(
                addCommentThunk({ taskId, projectId, content: newComment.trim() })
            ).unwrap();
            setComments((prev) => [...prev, result.comment]);
            setNewComment("");
            toast.success("Comment added.");
        } catch (error) {
            toast.error(error?.message || "Failed to add comment");
        }
    };

    useEffect(() => { fetchTaskDetails(); }, [taskId, currentWorkspace]);

    useEffect(() => {
        if (taskId && task) {
            fetchComments();
            const interval = setInterval(fetchComments, 15000);
            return () => clearInterval(interval);
        }
    }, [taskId, task]);

    // Listen for new commits via SSE to show the pulsing dot on the tab
    useEffect(() => {
        if (!taskId) return;
        const es = new EventSource(`/api/tasks/${taskId}/commit-events`);
        es.onmessage = () => {
            if (activeTab !== "development") setHasNewCommit(true);
        };
        return () => es.close();
    }, [taskId, activeTab]);

    const taskKey = project?.slug && task?.taskNumber
        ? `${project.slug}-${task.taskNumber}`
        : null;

    if (loading) return <div className="text-gray-500 dark:text-zinc-400 px-4 py-6">Loading task details...</div>;
    if (!task) return <div className="text-red-500 px-4 py-6">Task not found.</div>;

    return (
        <div className="flex flex-col-reverse lg:flex-row gap-6 sm:p-4 text-gray-900 dark:text-zinc-100 max-w-6xl mx-auto">
            <div className="w-full lg:w-2/3">
                <div className="rounded-md border border-gray-300 dark:border-zinc-800 flex flex-col lg:h-[80vh]">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-300 dark:border-zinc-800">
                        <button
                            onClick={() => setActiveTab("discussion")}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                activeTab === "discussion"
                                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                    : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            }`}
                        >
                            <MessageCircle className="size-4" />
                            Discussion ({comments.length})
                        </button>
                        <button
                            onClick={() => { setActiveTab("development"); setHasNewCommit(false); }}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                activeTab === "development"
                                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                    : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            }`}
                        >
                            <GitCommit className="size-4" />
                            Development
                            {hasNewCommit && (
                                <span className="relative flex size-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col p-5 overflow-hidden">
                        {activeTab === "discussion" ? (
                            <>
                                <div className="flex-1 md:overflow-y-scroll no-scrollbar">
                                    {comments.length > 0 ? (
                                        <div className="flex flex-col gap-4 mb-6 mr-2">
                                            {comments.map((comment) => (
                                                <div
                                                    key={comment.id}
                                                    className={`sm:max-w-4/5 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-900 border border-gray-300 dark:border-zinc-700 p-3 rounded-md ${comment.userId === userId ? "ml-auto" : "mr-auto"}`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1 text-sm text-gray-500 dark:text-zinc-400">
                                                        {comment.user?.image && (
                                                            <img src={comment.user.image} alt="avatar" className="size-5 rounded-full" />
                                                        )}
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {comment.user?.name || "User"}
                                                        </span>
                                                        <span className="text-xs text-gray-400 dark:text-zinc-600">
                                                            · {format(new Date(comment.createdAt), "dd MMM yyyy, HH:mm")}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-900 dark:text-zinc-200">{comment.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 dark:text-zinc-500 mb-4 text-sm">No comments yet. Be the first!</p>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Write a comment..."
                                        className="w-full dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-900 dark:text-zinc-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-600"
                                        rows={3}
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        className="bg-gradient-to-l from-blue-500 to-blue-600 transition-colors text-white text-sm px-5 py-2 rounded"
                                    >
                                        Post
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {taskKey && (
                                    <div className="mb-4 flex items-center gap-2 p-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                        <GitCommit className="size-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            Use{" "}
                                            <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-blue-600 dark:text-blue-400 text-xs">
                                                {taskKey}
                                            </code>{" "}
                                            in your commit message to link commits here.
                                        </p>
                                    </div>
                                )}
                                <TaskCommits taskId={taskId} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col gap-6">
                <div className="p-5 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800">
                    <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                            {taskKey && (
                                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono text-xs border border-zinc-200 dark:border-zinc-700">
                                    {taskKey}
                                </span>
                            )}
                        </div>
                        <h1 className="text-lg font-medium text-gray-900 dark:text-zinc-100">{task.title}</h1>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-300 text-xs">{task.status}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-300 text-xs">{task.type}</span>
                            <span className="px-2 py-0.5 rounded bg-green-200 dark:bg-emerald-900 text-green-900 dark:text-emerald-300 text-xs">{task.priority}</span>
                        </div>
                    </div>

                    {task.description && (
                        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">{task.description}</p>
                    )}

                    <hr className="border-zinc-200 dark:border-zinc-700 my-3" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-zinc-300">
                        <div className="flex items-center gap-2">
                            {task.assignee?.image && (
                                <img src={task.assignee.image} className="size-5 rounded-full" alt="avatar" />
                            )}
                            {task.assignee?.name || "Unassigned"}
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="size-4 text-gray-500 dark:text-zinc-500" />
                            {task.dueDate ? `Due: ${format(new Date(task.dueDate), "dd MMM yyyy")}` : "No due date"}
                        </div>
                    </div>
                </div>

                {project && (
                    <div className="p-4 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-800">
                        <p className="text-xl font-medium mb-4">Project Details</p>
                        <h2 className="text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                            <PenIcon className="size-4" /> {project.name}
                        </h2>
                        {project.startDate && (
                            <p className="text-xs mt-3">
                                Project Start: {format(new Date(project.startDate), "dd MMM yyyy")}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-zinc-400 mt-3">
                            <span>Status: {project.status}</span>
                            <span>Priority: {project.priority}</span>
                            <span>Progress: {project.progress}%</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
