import { useState, useRef, useEffect } from "react";
import { UserPlus, ChevronDown, UserCircle2 } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { addProjectMemberThunk } from "../features/workspaceSlice";

function Avatar({ user, size }) {
    const [imgError, setImgError] = useState(false);
    const sizeClass = `size-${size}`;
    const initials = user.name
        ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
        : "?";

    if (user.image && !imgError) {
        return (
            <img
                src={user.image}
                alt={user.name}
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

function MemberPicker({ availableMembers, value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = availableMembers.find((m) => m.user.email === value) ?? null;

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
                        <Avatar user={selected.user} size={5} />
                        <span className="flex-1 truncate text-zinc-900 dark:text-zinc-200">{selected.user.name || selected.user.email}</span>
                    </>
                ) : (
                    <>
                        <UserCircle2 className="size-5 text-zinc-400 flex-shrink-0" />
                        <span className="flex-1 text-zinc-400">Select a member</span>
                    </>
                )}
                <ChevronDown className={`size-4 text-zinc-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
            </button>

            {open && (
                <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {availableMembers.map((member) => (
                        <li key={member.userId}>
                            <button
                                type="button"
                                onClick={() => { onChange(member.user.email); setOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left ${value === member.user.email ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
                            >
                                <Avatar user={member.user} size={6} />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-zinc-900 dark:text-zinc-100 font-medium">{member.user.name || member.user.email}</p>
                                    <p className="truncate text-xs text-zinc-400">{member.user.email}</p>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

const AddProjectMember = ({ isDialogOpen, setIsDialogOpen }) => {
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();

    const id = searchParams.get("id");
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const project = currentWorkspace?.projects?.find((p) => p.id === id);
    const projectMemberUserIds = project?.members?.map((member) => member.userId) || [];

    const [email, setEmail] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !project) return;
        const member = currentWorkspace?.members?.find((m) => m.user.email === email);
        if (!member) {
            toast.error("Member not found in workspace");
            return;
        }
        setIsAdding(true);
        try {
            await dispatch(addProjectMemberThunk({ projectId: id, userId: member.userId })).unwrap();
            toast.success("Member added to project!");
            setEmail("");
            setIsDialogOpen(false);
        } catch (err) {
            toast.error(err.message || "Failed to add member");
        } finally {
            setIsAdding(false);
        }
    };

    if (!isDialogOpen) return null;

    const availableMembers = currentWorkspace?.members?.filter(
        (member) => !projectMemberUserIds.includes(member.userId)
    ) || [];

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                <div className="mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserPlus className="size-5" /> Add Member to Project
                    </h2>
                    {project && (
                        <p className="text-sm text-zinc-700 dark:text-zinc-400">
                            Adding to: <span className="text-blue-600 dark:text-blue-400">{project.name}</span>
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                            Workspace Member
                        </label>
                        {availableMembers.length === 0 ? (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                All workspace members are already in this project.
                            </p>
                        ) : (
                            <MemberPicker
                                availableMembers={availableMembers}
                                value={email}
                                onChange={setEmail}
                            />
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsDialogOpen(false)}
                            className="px-5 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isAdding || !email || availableMembers.length === 0}
                            className="px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white disabled:opacity-50 transition"
                        >
                            {isAdding ? "Adding..." : "Add Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddProjectMember;
