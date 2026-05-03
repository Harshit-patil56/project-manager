import { format } from "date-fns";
import toast from "react-hot-toast";
import { useAuth } from "@clerk/react";
import { useOrganization } from "@clerk/react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarIcon, MessageCircle, Github, PenIcon, TagIcon, ClockIcon, PlusIcon, XIcon, UserCircle2Icon, ChevronDown, AtSignIcon } from "lucide-react";
import { addCommentThunk, addTaskAssigneeThunk, removeTaskAssigneeThunk } from "../features/workspaceSlice";
import { apiFetch } from "../lib/api";
import TaskCommits from "../components/TaskCommits";

function parseMinutes(input) {
    if (!input) return null;
    const str = String(input).trim().toLowerCase();
    let total = 0;
    const hours = str.match(/(\d+(?:\.\d+)?)\s*h/);
    const mins = str.match(/(\d+)\s*m/);
    if (hours) total += parseFloat(hours[1]) * 60;
    if (mins) total += parseInt(mins[1]);
    if (!hours && !mins) {
        const num = parseFloat(str);
        if (!isNaN(num)) total = num * 60;
    }
    return total > 0 ? Math.round(total) : null;
}

function formatMinutes(mins) {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function LabelChip({ label, onRemove }) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: label.color }}
        >
            {label.name}
            {onRemove && (
                <button onClick={onRemove} className="hover:opacity-70 transition ml-0.5">
                    <XIcon className="size-2.5" />
                </button>
            )}
        </span>
    );
}

function UserAvatar({ user, size = 6 }) {
    const [err, setErr] = useState(false);
    const cls = `size-${size}`;
    if (user?.image && !err) {
        return <img src={user.image} alt={user.name} className={`${cls} rounded-full object-cover flex-shrink-0`} onError={() => setErr(true)} />;
    }
    return (
        <div className={`${cls} rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0`}>
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
        </div>
    );
}



const TaskDetails = () => {
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    const dispatch = useDispatch();
    const { userId } = useAuth();
    const { memberships } = useOrganization({ memberships: {} });
    const [task, setTask] = useState(null);
    const [project, setProject] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("discussion");
    const [hasNewCommit, setHasNewCommit] = useState(false);
    const [commits, setCommits] = useState([]);

    // Labels
    const [labels, setLabels] = useState([]);
    const [taskLabels, setTaskLabels] = useState([]);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [newLabelName, setNewLabelName] = useState("");
    const [newLabelColor, setNewLabelColor] = useState("#6366f1");
    const labelPickerRef = useRef(null);

    // Time tracking
    const [estimateInput, setEstimateInput] = useState("");
    const [logInput, setLogInput] = useState("");
    const [editingEstimate, setEditingEstimate] = useState(false);
    const [editingLog, setEditingLog] = useState(false);

    // Multiple assignees
    const [extraAssignees, setExtraAssignees] = useState([]);
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);
    const assigneePickerRef = useRef(null);

    // @mention autocomplete
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionCursorPos, setMentionCursorPos] = useState(0);
    const commentRef = useRef(null);

    const { currentWorkspace } = useSelector((state) => state.workspace);

    const teamMembers = (memberships?.data ?? []).map((m) => {
        const first = m.publicUserData?.firstName ?? "";
        const last = m.publicUserData?.lastName ?? "";
        const name = [first, last].filter(Boolean).join(" ") || m.publicUserData?.identifier || "Unknown";
        return { id: m.publicUserData?.userId, name, email: m.publicUserData?.identifier, image: m.publicUserData?.imageUrl };
    });

    const renderCommentWithMentions = (content) => {
        if (!content) return null;
        const names = teamMembers.map(m => m.name).filter(Boolean);
        if (names.length === 0) {
            // Fallback to simple regex if no names yet
            const parts = content.split(/(@[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g);
            return parts.map((part, i) => {
                if (part.startsWith("@")) {
                    return <span key={i} className="text-blue-600 dark:text-blue-400 font-medium">{part}</span>;
                }
                return part;
            });
        }

        // Sort names by length descending to match longest first
        const sortedNames = [...names].sort((a, b) => b.length - a.length);
        const escapedNames = sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const regex = new RegExp(`(@(?:${escapedNames}))`, 'g');

        const parts = content.split(regex);
        return parts.map((part, i) => {
            if (part.startsWith("@") && names.some(n => `@${n}` === part)) {
                return (
                    <span key={i} className="text-blue-600 dark:text-blue-400 font-medium">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const fetchComments = async () => {
        if (!taskId) return;
        try { setComments(await apiFetch(`/api/tasks/${taskId}/comments`) || []); } catch { }
    };

    const fetchTaskData = useCallback(async () => {
        if (!taskId) return;
        const [tl, ea] = await Promise.all([
            apiFetch(`/api/tasks/${taskId}/labels`).catch(() => []),
            apiFetch(`/api/tasks/${taskId}/assignees`).catch(() => []),
        ]);
        setTaskLabels(tl || []);
        setExtraAssignees(ea || []);
    }, [taskId]);

    const fetchTaskDetails = async () => {
        setLoading(true);
        if (!projectId || !taskId) return;
        try {
            if (currentWorkspace) {
                const proj = currentWorkspace.projects.find((p) => p.id === projectId);
                if (proj) {
                    const tsk = proj.tasks.find((t) => t.id === taskId);
                    if (tsk) { setTask(tsk); setProject(proj); setLoading(false); return; }
                }
            }
            const [tsk, proj] = await Promise.all([apiFetch(`/api/tasks/${taskId}`), apiFetch(`/api/projects/${projectId}`)]);
            setTask(tsk); setProject(proj);
        } catch { toast.error("Failed to load task details"); } finally { setLoading(false); }
    };

    const fetchProjectLabels = useCallback(async () => {
        if (!task?.projectId) return;
        const data = await apiFetch(`/api/projects/${task.projectId}/labels`).catch(() => []);
        setLabels(data || []);
    }, [task?.projectId]);

    useEffect(() => { fetchTaskDetails(); }, [taskId, currentWorkspace]);
    useEffect(() => { if (taskId && task) { fetchComments(); fetchTaskData(); const iv = setInterval(fetchComments, 15000); return () => clearInterval(iv); } }, [taskId, task]);
    useEffect(() => { if (task) fetchProjectLabels(); }, [task, fetchProjectLabels]);
    useEffect(() => { if (!taskId) return; apiFetch(`/api/tasks/${taskId}/commits`).then((d) => setCommits(d || [])).catch(() => {}); }, [taskId]);
    useEffect(() => {
        if (!taskId) return;
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const es = new EventSource(`${baseUrl}/api/tasks/${taskId}/commit-events`);
        es.onmessage = (e) => { try { setCommits((p) => [JSON.parse(e.data), ...p]); } catch { } if (activeTab !== "development") setHasNewCommit(true); };
        return () => es.close();
    }, [taskId, activeTab]);

    // Close pickers on outside click
    useEffect(() => {
        function h(e) {
            if (labelPickerRef.current && !labelPickerRef.current.contains(e.target)) setShowLabelPicker(false);
            if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target)) setShowAssigneePicker(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            const result = await dispatch(addCommentThunk({ taskId, projectId: task?.projectId || projectId, content: newComment.trim() })).unwrap();
            setComments((prev) => [...prev, result.comment]);
            setNewComment("");
            setMentionOpen(false);
            toast.success("Comment added.");
        } catch (error) { toast.error(error?.message || "Failed to add comment"); }
    };

    // @mention handling
    const handleCommentChange = (e) => {
        const val = e.target.value;
        setNewComment(val);
        const cursor = e.target.selectionStart;
        setMentionCursorPos(cursor);
        const before = val.slice(0, cursor);
        const atMatch = before.match(/@(\w*)$/);
        if (atMatch) {
            setMentionQuery(atMatch[1].toLowerCase());
            setMentionOpen(true);
        } else {
            setMentionOpen(false);
            setMentionQuery("");
        }
    };

    const insertMention = (member) => {
        const before = newComment.slice(0, mentionCursorPos);
        const after = newComment.slice(mentionCursorPos);
        const atStart = before.lastIndexOf("@");
        const newVal = before.slice(0, atStart) + `@${member.name} ` + after;
        setNewComment(newVal);
        setMentionOpen(false);
        setMentionQuery("");
        commentRef.current?.focus();
    };

    const filteredMentions = teamMembers.filter(m => m.name.toLowerCase().includes(mentionQuery));

    // Labels
    const handleAddLabel = async (labelId) => {
        try {
            const label = await apiFetch(`/api/tasks/${taskId}/labels`, { method: "POST", body: JSON.stringify({ labelId }) });
            setTaskLabels(prev => [...prev, label]);
            setShowLabelPicker(false);
        } catch (e) { if (!e.message?.includes("409")) toast.error("Failed to add label"); }
    };

    const handleRemoveLabel = async (labelId) => {
        try {
            await apiFetch(`/api/tasks/${taskId}/labels/${labelId}`, { method: "DELETE" });
            setTaskLabels(prev => prev.filter(l => l.id !== labelId));
        } catch { toast.error("Failed to remove label"); }
    };

    const handleCreateLabel = async (e) => {
        e.preventDefault();
        if (!newLabelName.trim()) return;
        try {
            const label = await apiFetch(`/api/projects/${task.projectId}/labels`, { method: "POST", body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }) });
            setLabels(prev => [...prev, label]);
            setNewLabelName("");
            await handleAddLabel(label.id);
        } catch { toast.error("Failed to create label"); }
    };

    // Time tracking
    const handleSaveEstimate = async () => {
        const mins = parseMinutes(estimateInput);
        if (mins === null && estimateInput.trim()) { toast.error("Invalid format. Use '2h', '30m', or '1h 30m'"); return; }
        try {
            await apiFetch(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ estimatedMinutes: mins }) });
            setTask(prev => ({ ...prev, estimatedMinutes: mins }));
            setEditingEstimate(false);
        } catch { toast.error("Failed to save estimate"); }
    };

    const handleLogTime = async () => {
        const add = parseMinutes(logInput);
        if (!add) { toast.error("Invalid format. Use '2h', '30m', or '1h 30m'"); return; }
        const newLogged = (task?.loggedMinutes ?? 0) + add;
        try {
            await apiFetch(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ loggedMinutes: newLogged }) });
            setTask(prev => ({ ...prev, loggedMinutes: newLogged }));
            setLogInput("");
            setEditingLog(false);
            toast.success(`Logged ${formatMinutes(add)}`);
        } catch { toast.error("Failed to log time"); }
    };

    // Multiple assignees
    const handleAddAssignee = async (memberId) => {
        try {
            const result = await dispatch(addTaskAssigneeThunk({ taskId, projectId: task?.projectId || projectId, userId: memberId })).unwrap();
            setExtraAssignees(prev => [...prev, result.user]);
            setShowAssigneePicker(false);
            toast.success("Assignee added.");
        } catch (e) { if (!e.message?.includes("409") && !e.message?.includes("Maximum")) toast.error("Failed to add assignee"); else toast.error(e.message); }
    };

    const handleRemoveAssignee = async (targetId) => {
        try {
            await dispatch(removeTaskAssigneeThunk({ taskId, projectId: task?.projectId || projectId, userId: targetId })).unwrap();
            setExtraAssignees(prev => prev.filter(a => a.id !== targetId));
            toast.success("Assignee removed.");
        } catch { toast.error("Failed to remove assignee"); }
    };

    const taskKey = project?.slug && task?.taskNumber ? `${project.slug}-${task.taskNumber}` : null;
    const availableLabels = labels.filter(l => !taskLabels.find(tl => tl.id === l.id));
    const assignedIds = new Set([task?.assigneeId, ...extraAssignees.map(a => a.id)]);
    const availableMembers = teamMembers.filter(m => !assignedIds.has(m.id));

    const loggedPct = task?.estimatedMinutes > 0
        ? Math.min(100, Math.round(((task?.loggedMinutes ?? 0) / task.estimatedMinutes) * 100))
        : 0;

    if (loading) return <div className="text-gray-500 dark:text-zinc-400 px-4 py-6">Loading task details...</div>;
    if (!task) return <div className="text-red-500 px-4 py-6">Task not found.</div>;

    return (
        <div className="flex flex-col-reverse lg:flex-row gap-6 sm:p-4 text-gray-900 dark:text-zinc-100 max-w-6xl mx-auto">
            {/* Left: Discussion / Development */}
            <div className="w-full lg:w-2/3">
                <div className="rounded-md border border-gray-300 dark:border-zinc-800 flex flex-col lg:h-[80vh]">
                    <div className="flex border-b border-gray-300 dark:border-zinc-800">
                        <button onClick={() => setActiveTab("discussion")} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "discussion" ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}>
                            <MessageCircle className="size-4" /> Discussion ({comments.length})
                        </button>
                        <button onClick={() => { setActiveTab("development"); setHasNewCommit(false); }} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "development" ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}>
                            <Github className="size-4" /> Development ({commits.length})
                            {hasNewCommit && <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full size-2 bg-green-500" /></span>}
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col p-5 overflow-hidden">
                        {activeTab === "discussion" ? (
                            <>
                                <div className="flex-1 md:overflow-y-scroll no-scrollbar">
                                    {comments.length > 0 ? (
                                        <div className="flex flex-col gap-4 mb-6 mr-2">
                                            {comments.map((comment) => (
                                                <div key={comment.id} className={`sm:max-w-4/5 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-900 border border-gray-300 dark:border-zinc-700 p-3 rounded-md ${comment.userId === userId ? "ml-auto" : "mr-auto"}`}>
                                                    <div className="flex items-center gap-2 mb-1 text-sm text-gray-500 dark:text-zinc-400">
                                                        {comment.user?.image && <img src={comment.user.image} alt="avatar" className="size-5 rounded-full" />}
                                                        <span className="font-medium text-gray-900 dark:text-white">{comment.user?.name || "User"}</span>
                                                        <span className="text-xs text-gray-400 dark:text-zinc-600">· {format(new Date(comment.createdAt), "dd MMM yyyy, HH:mm")}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-900 dark:text-zinc-200 whitespace-pre-wrap">{renderCommentWithMentions(comment.content)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 dark:text-zinc-500 mb-4 text-sm">No comments yet. Be the first!</p>
                                    )}
                                </div>

                                {/* Comment input */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 relative">
                                    <div className="w-full relative">
                                        <textarea
                                            ref={commentRef}
                                            value={newComment}
                                            onChange={handleCommentChange}
                                            placeholder="Write a comment… use @ to mention someone"
                                            className="w-full dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-900 dark:text-zinc-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            rows={3}
                                        />
                                        {mentionOpen && filteredMentions.length > 0 && (
                                            <div className="absolute bottom-full left-0 mb-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden">
                                                {filteredMentions.map(m => (
                                                    <button key={m.id} onClick={() => insertMention(m)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm">
                                                        <UserAvatar user={m} size={5} />
                                                        <span className="text-zinc-800 dark:text-zinc-200 truncate">{m.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={handleAddComment} className="bg-gradient-to-l from-blue-500 to-blue-600 transition-colors text-white text-sm px-5 py-2 rounded">Post</button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {taskKey && (
                                    <div className="mb-4 flex items-center gap-2 p-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                        <Github className="size-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            Use <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-blue-600 dark:text-blue-400 text-xs">{taskKey}</code> in your commit message to link commits here.
                                        </p>
                                    </div>
                                )}
                                <TaskCommits taskId={taskId} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Task Details */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4">
                {/* Main Task Info */}
                <div className="p-5 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800">
                    <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                            {taskKey && <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono text-xs border border-zinc-200 dark:border-zinc-700">{taskKey}</span>}
                        </div>
                        <h1 className="text-lg font-medium text-gray-900 dark:text-zinc-100">{task.title}</h1>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-300 text-xs">{task.status}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-300 text-xs">{task.type}</span>
                            <span className="px-2 py-0.5 rounded bg-green-200 dark:bg-emerald-900 text-green-900 dark:text-emerald-300 text-xs">{task.priority}</span>
                        </div>
                    </div>

                    {task.description && <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">{task.description}</p>}

                    {/* Labels */}
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <TagIcon className="size-3.5 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Labels</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {taskLabels.map(l => <LabelChip key={l.id} label={l} onRemove={() => handleRemoveLabel(l.id)} />)}
                            <div className="relative" ref={labelPickerRef}>
                                <button onClick={() => setShowLabelPicker(o => !o)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-zinc-400 transition">
                                    <PlusIcon className="size-2.5" /> Add
                                </button>
                                {showLabelPicker && (
                                    <div className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 p-2 space-y-1 overflow-hidden">
                                        {availableLabels.length > 0 && (
                                            <div className="space-y-0.5">
                                                {availableLabels.map(l => (
                                                    <button key={l.id} onClick={() => handleAddLabel(l.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left">
                                                        <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                                                        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{l.name}</span>
                                                    </button>
                                                ))}
                                                <hr className="border-zinc-100 dark:border-zinc-800 my-1" />
                                            </div>
                                        )}
                                        <form onSubmit={handleCreateLabel} className="space-y-1.5 pt-1">
                                            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-1">New label</p>
                                            <div className="flex gap-1.5 min-w-0">
                                                <input value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} type="color" className="size-7 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 flex-shrink-0" />
                                                <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="Label name" className="min-w-0 flex-1 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-400" />
                                            </div>
                                            <button type="submit" className="w-full text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 text-white transition">Create & Add</button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <hr className="border-zinc-200 dark:border-zinc-700 my-3" />

                    {/* Assignees */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Assignees</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-2">
                            {/* Primary assignee */}
                            {task.assignee && (
                                <div className="flex items-center gap-1.5">
                                    <UserAvatar user={task.assignee} size={6} />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{task.assignee.name}</span>
                                </div>
                            )}
                            {/* Extra assignees */}
                            {extraAssignees.map(a => (
                                <div key={a.id} className="group relative flex items-center gap-1.5">
                                    <UserAvatar user={a} size={6} />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{a.name}</span>
                                    <button onClick={() => handleRemoveAssignee(a.id)} className="opacity-0 group-hover:opacity-100 transition ml-0.5 text-zinc-400 hover:text-red-500">
                                        <XIcon className="size-3" />
                                    </button>
                                </div>
                            ))}
                            {/* Add assignee button */}
                            {(1 + extraAssignees.length) < 5 && availableMembers.length > 0 && (
                                <div className="relative" ref={assigneePickerRef}>
                                    <button onClick={() => setShowAssigneePicker(o => !o)} className="size-6 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition">
                                        <PlusIcon className="size-3" />
                                    </button>
                                    {showAssigneePicker && (
                                        <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden">
                                            {availableMembers.map(m => (
                                                <button key={m.id} onClick={() => handleAddAssignee(m.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-sm">
                                                    <UserAvatar user={{ name: m.name, image: m.image }} size={5} />
                                                    <div className="min-w-0">
                                                        <p className="text-zinc-800 dark:text-zinc-200 truncate text-sm">{m.name}</p>
                                                        <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <hr className="border-zinc-200 dark:border-zinc-700 my-3" />

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-zinc-300">
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="size-4 text-gray-500 dark:text-zinc-500" />
                            {task.dueDate ? `Due: ${format(new Date(task.dueDate), "dd MMM yyyy")}` : "No due date"}
                        </div>
                        {task.startDate && (
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="size-4 text-gray-500 dark:text-zinc-500" />
                                Start: {format(new Date(task.startDate), "dd MMM yyyy")}
                            </div>
                        )}
                    </div>
                </div>

                {/* Time Tracking */}
                <div className="p-4 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-3">
                        <ClockIcon className="size-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Time Tracking</span>
                    </div>

                    {/* Progress bar */}
                    {task.estimatedMinutes > 0 && (
                        <div className="mb-3">
                            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                                <span>{formatMinutes(task.loggedMinutes ?? 0)} logged</span>
                                <span>{formatMinutes(task.estimatedMinutes)} estimated</span>
                            </div>
                            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${loggedPct >= 100 ? 'bg-red-500' : loggedPct >= 75 ? 'bg-amber-400' : 'bg-blue-500'}`}
                                    style={{ width: `${loggedPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Estimate</label>
                            {editingEstimate ? (
                                <div className="flex gap-2">
                                    <input value={estimateInput} onChange={e => setEstimateInput(e.target.value)} placeholder="2h 30m" autoFocus className="flex-1 text-xs px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-400" onKeyDown={e => { if (e.key === 'Enter') handleSaveEstimate(); if (e.key === 'Escape') setEditingEstimate(false); }} />
                                    <button onClick={handleSaveEstimate} className="text-xs px-3 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap">Save</button>
                                </div>
                            ) : (
                                <button onClick={() => { setEstimateInput(""); setEditingEstimate(true); }} className="w-full text-left text-sm px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                    {task.estimatedMinutes ? formatMinutes(task.estimatedMinutes) : <span className="text-zinc-400 dark:text-zinc-500">Set estimate</span>}
                                </button>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Log Time</label>
                            {editingLog ? (
                                <div className="flex gap-2">
                                    <input value={logInput} onChange={e => setLogInput(e.target.value)} placeholder="1h" autoFocus className="flex-1 text-xs px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-400" onKeyDown={e => { if (e.key === 'Enter') handleLogTime(); if (e.key === 'Escape') setEditingLog(false); }} />
                                    <button onClick={handleLogTime} className="text-xs px-3 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap">Log</button>
                                </div>
                            ) : (
                                <button onClick={() => { setLogInput(""); setEditingLog(true); }} className="w-full text-left text-sm px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                    {task.loggedMinutes ? formatMinutes(task.loggedMinutes) : <span className="text-zinc-400 dark:text-zinc-500">Log time</span>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Project Info */}
                {project && (
                    <div className="p-4 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-800">
                        <p className="text-xl font-medium mb-4">Project Details</p>
                        <h2 className="text-gray-900 dark:text-zinc-100 flex items-center gap-2"><PenIcon className="size-4" /> {project.name}</h2>
                        {project.startDate && <p className="text-xs mt-3">Project Start: {format(new Date(project.startDate), "dd MMM yyyy")}</p>}
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
