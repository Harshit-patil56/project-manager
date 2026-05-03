import { format } from "date-fns";
import { Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AddProjectMember from "./AddProjectMember";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import GitHubIntegration from "./GitHubIntegration";
import { updateProjectThunk, archiveProjectThunk } from "../features/workspaceSlice";

export default function ProjectSettings({ project }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        status: "PLANNING",
        priority: "MEDIUM",
        startDate: null,
        endDate: null,
        progress: 0,
    });

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await dispatch(
                updateProjectThunk({
                    projectId: project.id,
                    name: formData.name,
                    description: formData.description,
                    status: formData.status,
                    priority: formData.priority,
                    startDate: formData.startDate || undefined,
                    endDate: formData.endDate || undefined,
                    progress: formData.progress,
                })
            ).unwrap();
            toast.success("Project updated!");
        } catch (err) {
            toast.error(err?.message || "Failed to update project");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchiveProject = async () => {
        setIsArchiving(true);
        const loadingId = toast.loading("Archiving project...");
        try {
            await dispatch(archiveProjectThunk({ projectId: project.id, workspaceId: project.workspaceId })).unwrap();
            toast.dismiss(loadingId);
            toast.success("Project archived");
            setShowArchiveConfirm(false);
            navigate("/projects");
        } catch (err) {
            toast.dismiss(loadingId);
            toast.error(err?.message || "Failed to archive project");
        } finally {
            setIsArchiving(false);
        }
    };

    useEffect(() => {
        if (project) {
            setFormData({
                name: project.name || "",
                description: project.description || "",
                status: project.status || "PLANNING",
                priority: project.priority || "MEDIUM",
                startDate: project.startDate ? project.startDate.split("T")[0] : "",
                endDate: project.endDate ? project.endDate.split("T")[0] : "",
                progress: project.progress ?? 0,
            });
        }
    }, [project]);

    const inputClasses = "w-full px-3 py-2 rounded mt-2 border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300";
    const cardClasses = "rounded-lg border p-6 bg-white dark:bg-gradient-to-br dark:from-zinc-800/80 dark:to-zinc-800/40 border-zinc-200 dark:border-zinc-700";
    const labelClasses = "text-sm text-zinc-600 dark:text-zinc-400";

    return (
        <>
            <div className="grid lg:grid-cols-2 gap-8">
                <div className={cardClasses}>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300 mb-4">Project Details</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Project Name</label>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={inputClasses}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className={labelClasses}>Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className={inputClasses + " h-24"}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClasses}>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className={inputClasses}
                                >
                                    <option value="PLANNING">Planning</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="ON_HOLD">On Hold</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className={labelClasses}>Priority</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                    className={inputClasses}
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className={labelClasses}>Start Date</label>
                                <input
                                    type="date"
                                    value={formData.startDate || ""}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className={inputClasses}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={labelClasses}>End Date</label>
                                <input
                                    type="date"
                                    value={formData.endDate || ""}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className={inputClasses}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={labelClasses}>Progress: {formData.progress}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={formData.progress}
                                onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                                className="w-full accent-blue-500 dark:accent-blue-400"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="ml-auto flex items-center text-sm justify-center gap-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
                        >
                            <Save className="size-4" /> {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </form>
                </div>

                <div className="space-y-6">
                    <div className={cardClasses}>
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300 mb-4">
                                Team Members <span className="text-sm text-zinc-600 dark:text-zinc-400">({project.members?.length || 0})</span>
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsDialogOpen(true)}
                                className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Plus className="size-4 text-zinc-900 dark:text-zinc-300" />
                            </button>
                            <AddProjectMember isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
                        </div>

                        {project.members?.length > 0 && (
                            <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                                {project.members.map((member, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between px-3 py-2 rounded dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-300"
                                    >
                                        <div className="flex items-center gap-2">
                                            {member?.user?.image && (
                                                <img src={member.user.image} alt="" className="size-5 rounded-full" />
                                            )}
                                            <span>{member?.user?.name || member?.user?.email || "Unknown"}</span>
                                        </div>
                                        {project.teamLead === member.userId && (
                                            <span className="px-2 py-0.5 rounded-xs ring ring-zinc-200 dark:ring-zinc-600 text-xs">Team Lead</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border p-6 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                        <h2 className="text-base font-medium text-red-700 dark:text-red-400 mb-1">Danger Zone</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                            Archiving this project will move it to Trash. It can be restored within 30 days.
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowArchiveConfirm(true)}
                            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                            Archive Project
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <GitHubIntegration project={project} />
            </div>

            <ConfirmDeleteDialog
                isOpen={showArchiveConfirm}
                onClose={() => setShowArchiveConfirm(false)}
                onConfirm={handleArchiveProject}
                itemName={project?.name}
                isLoading={isArchiving}
            />
        </>
    );
}
