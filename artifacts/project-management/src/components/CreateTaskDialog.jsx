import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { useDispatch } from "react-redux";
import { format } from "date-fns";
import { createTaskThunk } from "../features/workspaceSlice";
import toast from "react-hot-toast";
import { useOrganization } from "@clerk/react";

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
        dueDate: "",
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.assigneeId) {
            toast.error("Please select an assignee");
            return;
        }
        if (!formData.dueDate) {
            toast.error("Please select a due date");
            return;
        }
        setIsSubmitting(true);
        try {
            await dispatch(
                createTaskThunk({
                    projectId,
                    title: formData.title,
                    description: formData.description || undefined,
                    type: formData.type,
                    status: formData.status,
                    priority: formData.priority,
                    assigneeId: formData.assigneeId,
                    dueDate: formData.dueDate,
                })
            ).unwrap();
            toast.success("Task created!");
            setShowCreateTask(false);
            setFormData({ title: "", description: "", type: "TASK", status: "TODO", priority: "MEDIUM", assigneeId: "", dueDate: "" });
        } catch (err) {
            toast.error(err?.message || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    return showCreateTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 text-zinc-900 dark:text-white">
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
                            className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <label className="text-sm font-medium">Assignee</label>
                            <select
                                value={formData.assigneeId}
                                onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"
                            >
                                <option value="">Select assignee</option>
                                {teamMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name}
                                    </option>
                                ))}
                            </select>
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

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Due Date</label>
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="size-5 text-zinc-500 dark:text-zinc-400" />
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                min={new Date().toISOString().split("T")[0]}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"
                            />
                        </div>
                        {formData.dueDate && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {format(new Date(formData.dueDate), "PPP")}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCreateTask(false)}
                            className="rounded border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded px-5 py-2 text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white dark:text-zinc-200 transition disabled:opacity-60"
                        >
                            {isSubmitting ? "Creating..." : "Create Task"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    ) : null;
}
