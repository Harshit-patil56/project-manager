import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, UserCircle2, PlusIcon, XIcon } from "lucide-react";
import { useDispatch } from "react-redux";
import { format } from "date-fns";
import { createTaskThunk } from "../features/workspaceSlice";
import toast from "react-hot-toast";
import { useOrganization } from "@clerk/react";
import { apiFetch } from "../lib/api";

function Avatar({ member, size }) {
    const [imgError, setImgError] = useState(false);
    const sizeClass = `size-${size}`;
    const initials = member.name
        ? member.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
        : "?";
    if ((member.imageUrl || member.image) && !imgError) {
        return (
            <img
                src={member.imageUrl || member.image}
                alt={member.name}
                className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
                onError={() => setImgError(true)}
            />
        );
    }
    return (
        <span className={`${sizeClass} rounded-full flex-shrink-0 bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-[10px] font-semibold text-zinc-700 dark:text-zinc-200`}>
            {initials}
        </span>
    );
}

function AssigneePicker({ teamMembers, value, onChange, exclude = [] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const available = teamMembers.filter(m => !exclude.includes(m.id));
    const selected = teamMembers.find((m) => m.id === value) ?? null;

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm mt-1 focus:outline-none text-left"
            >
                {selected ? (
                    <>
                        <Avatar member={selected} size={5} />
                        <span className="flex-1 truncate text-zinc-900 dark:text-zinc-200">{selected.name}</span>
                    </>
                ) : (
                    <>
                        <UserCircle2 className="size-5 text-zinc-400 flex-shrink-0" />
                        <span className="flex-1 text-zinc-400">Select assignee</span>
                    </>
                )}
                <ChevronDown className={`size-4 text-zinc-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
            </button>
            {open && (
                <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {available.map((member) => (
                        <li key={member.id}>
                            <button
                                type="button"
                                onClick={() => { onChange(member.id); setOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left ${value === member.id ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
                            >
                                <Avatar member={member} size={6} />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-zinc-900 dark:text-zinc-100 font-medium">{member.name}</p>
                                    {member.email && <p className="truncate text-xs text-zinc-400">{member.email}</p>}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ExtraAssigneesPicker({ teamMembers, extraIds, onChange, primaryId }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const excluded = [primaryId, ...extraIds].filter(Boolean);
    const available = teamMembers.filter(m => !excluded.includes(m.id));

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const addMember = (id) => {
        if (extraIds.length >= 4) { toast.error("Maximum 5 assignees total"); return; }
        onChange([...extraIds, id]);
        setOpen(false);
    };

    const removeMember = (id) => onChange(extraIds.filter(i => i !== id));

    const selectedMembers = extraIds.map(id => teamMembers.find(m => m.id === id)).filter(Boolean);

    return (
        <div className="space-y-1">
            <label className="text-sm font-medium">Additional Assignees <span className="text-zinc-400 font-normal text-xs">(optional, max 4 more)</span></label>
            <div className="flex flex-wrap gap-1.5 items-center mt-1 min-h-[32px] p-1.5 rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900">
                {selectedMembers.map(m => (
                    <span key={m.id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-full pl-1 pr-1.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                        <Avatar member={m} size={4} />
                        {m.name.split(" ")[0]}
                        <button type="button" onClick={() => removeMember(m.id)} className="text-zinc-400 hover:text-red-500 ml-0.5 transition">
                            <XIcon className="size-2.5" />
                        </button>
                    </span>
                ))}
                {available.length > 0 && extraIds.length < 4 && (
                    <div ref={ref} className="relative">
                        <button
                            type="button"
                            onClick={() => setOpen(o => !o)}
                            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 px-1.5 py-0.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 transition"
                        >
                            <PlusIcon className="size-3" /> Add
                        </button>
                        {open && (
                            <ul className="absolute z-50 mt-1 left-0 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                {available.map(member => (
                                    <li key={member.id}>
                                        <button
                                            type="button"
                                            onClick={() => addMember(member.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition"
                                        >
                                            <Avatar member={member} size={5} />
                                            <div className="flex-1 min-w-0">
                                                <p className="truncate text-zinc-900 dark:text-zinc-100 text-sm">{member.name}</p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {selectedMembers.length === 0 && available.length === 0 && extraIds.length === 0 && (
                    <span className="text-xs text-zinc-400">No more members available</span>
                )}
            </div>
        </div>
    );
}

export default function CreateTaskDialog({ showCreateTask, setShowCreateTask, projectId }) {
    const dispatch = useDispatch();
    const { memberships } = useOrganization({ memberships: {} });
    const teamMembers = (memberships?.data ?? []).map((m) => {
        const firstName = m.publicUserData?.firstName ?? "";
        const lastName = m.publicUserData?.lastName ?? "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        const email = m.publicUserData?.identifier ?? "";
        return {
            id: m.publicUserData?.userId,
            name: fullName || email || "Unknown",
            email,
            imageUrl: m.publicUserData?.imageUrl ?? null,
        };
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "TASK",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: "",
        startDate: "",
        dueDate: "",
    });
    const [extraAssigneeIds, setExtraAssigneeIds] = useState([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.assigneeId) { toast.error("Please select an assignee"); return; }
        if (!formData.dueDate) { toast.error("Please select a due date"); return; }
        setIsSubmitting(true);
        try {
            const result = await dispatch(
                createTaskThunk({
                    projectId,
                    title: formData.title,
                    description: formData.description || undefined,
                    type: formData.type,
                    status: formData.status,
                    priority: formData.priority,
                    assigneeId: formData.assigneeId,
                    startDate: formData.startDate || undefined,
                    dueDate: formData.dueDate,
                })
            ).unwrap();

            // Add extra assignees if any
            if (extraAssigneeIds.length > 0 && result?.id) {
                await Promise.allSettled(
                    extraAssigneeIds.map(uid =>
                        apiFetch(`/api/tasks/${result.id}/assignees`, {
                            method: "POST",
                            body: JSON.stringify({ userId: uid }),
                        })
                    )
                );
            }

            toast.success("Task created!");
            setShowCreateTask(false);
            setFormData({ title: "", description: "", type: "TASK", status: "TODO", priority: "MEDIUM", assigneeId: "", startDate: "", dueDate: "" });
            setExtraAssigneeIds([]);
        } catch (err) {
            toast.error(err?.message || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    // When primary assignee changes, remove them from extra list
    const handlePrimaryChange = (id) => {
        setFormData(f => ({ ...f, assigneeId: id }));
        setExtraAssigneeIds(prev => prev.filter(i => i !== id));
    };

    return showCreateTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 text-zinc-900 dark:text-white max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Create New Task</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Title</label>
                        <input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Task title"
                            className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe the task"
                            className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"
                            >
                                <option value="BUG">Bug</option>
                                <option value="FEATURE">Feature</option>
                                <option value="TASK">Task</option>
                                <option value="IMPROVEMENT">Improvement</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Priority</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Primary Assignee</label>
                            <AssigneePicker
                                teamMembers={teamMembers}
                                value={formData.assigneeId}
                                onChange={handlePrimaryChange}
                                exclude={extraAssigneeIds}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"
                            >
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="DONE">Done</option>
                            </select>
                        </div>
                    </div>

                    <ExtraAssigneesPicker
                        teamMembers={teamMembers}
                        extraIds={extraAssigneeIds}
                        onChange={setExtraAssigneeIds}
                        primaryId={formData.assigneeId}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Start Date <span className="text-zinc-400 font-normal">(optional)</span></label>
                            <div className="flex items-center gap-2 mt-1">
                                <CalendarIcon className="size-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Due Date</label>
                            <div className="flex items-center gap-2 mt-1">
                                <CalendarIcon className="size-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    min={formData.startDate || new Date().toISOString().split("T")[0]}
                                    className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => { setShowCreateTask(false); setExtraAssigneeIds([]); }}
                            className="rounded border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded px-5 py-2 text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white transition disabled:opacity-60"
                        >
                            {isSubmitting ? "Creating..." : "Create Task"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    ) : null;
}
