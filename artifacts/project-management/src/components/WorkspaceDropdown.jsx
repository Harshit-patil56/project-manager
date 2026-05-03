import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, X, Loader2, Archive } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace, fetchWorkspaces, archiveWorkspaceThunk } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/react";
import { assets } from "../assets/assets";
import toast from "react-hot-toast";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

function WorkspaceDropdown() {
    const { workspaces, currentWorkspace } = useSelector((state) => state.workspace);
    const [isOpen, setIsOpen] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const dropdownRef = useRef(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { setActive, createOrganization } = useOrganizationList();
    const { userId } = useAuth();

    const currentUserRole = currentWorkspace?.members?.find((m) => m.userId === userId)?.role;
    const isAdmin = currentUserRole === "ADMIN";

    const onSelectWorkspace = (workspaceId) => {
        dispatch(setCurrentWorkspace(workspaceId));
        if (setActive) setActive({ organization: workspaceId });
        setIsOpen(false);
        navigate("/dashboard");
    };

    const handleCreateWorkspace = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        if (!createOrganization) {
            toast.error("Organization creation is not available. Make sure organizations are enabled in your Clerk dashboard.");
            return;
        }
        setIsCreating(true);
        try {
            const org = await createOrganization({ name: newName.trim() });
            
            // Upload logo if selected
            if (imageFile) {
                try {
                    await org.setLogo({ file: imageFile });
                } catch (logoErr) {
                    console.error("Failed to upload logo:", logoErr);
                    toast.error("Workspace created, but logo upload failed.");
                }
            }

            await new Promise((r) => setTimeout(r, 2000));
            await dispatch(fetchWorkspaces()).unwrap();
            if (org?.id) {
                dispatch(setCurrentWorkspace(org.id));
                if (setActive) await setActive({ organization: org.id });
            }
            setShowCreate(false);
            setNewName("");
            setImageFile(null);
            setImagePreview(null);
            setIsOpen(false);
            toast.success("Workspace created!");
            navigate("/dashboard");
        } catch (err) {
            toast.error(err?.message || "Failed to create workspace");
        } finally {
            setIsCreating(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Image size must be less than 2MB");
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleArchiveWorkspace = async () => {
        if (!currentWorkspace) return;
        setIsArchiving(true);
        const loadingId = toast.loading("Archiving workspace...");
        try {
            await dispatch(archiveWorkspaceThunk(currentWorkspace.id)).unwrap();
            toast.dismiss(loadingId);
            toast.success("Workspace archived");
            setShowArchiveConfirm(false);
            navigate("/dashboard");
        } catch (err) {
            toast.dismiss(loadingId);
            toast.error(err?.message || "Failed to archive workspace");
        } finally {
            setIsArchiving(false);
        }
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <>
            <div className="relative m-4" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3 h-auto text-left rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                    <div className="flex items-center gap-3">
                        <img
                            src={currentWorkspace?.imageUrl || assets.workspace_img_default}
                            alt={currentWorkspace?.name}
                            className="w-8 h-8 rounded shadow object-cover"
                            onError={(e) => { e.target.src = assets.workspace_img_default; }}
                        />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                                {currentWorkspace?.name || "Select Workspace"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0" />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded shadow-lg top-full left-0">
                        <div className="p-2">
                            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-2">
                                Workspaces
                            </p>
                            {workspaces.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-zinc-500 px-2 py-1">No workspaces yet</p>
                            ) : (
                                workspaces.map((ws) => (
                                    <div
                                        key={ws.id}
                                        onClick={() => onSelectWorkspace(ws.id)}
                                        className="flex items-center gap-3 p-2 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        <img
                                            src={ws.imageUrl || assets.workspace_img_default}
                                            alt={ws.name}
                                            className="w-6 h-6 rounded object-cover"
                                            onError={(e) => { e.target.src = assets.workspace_img_default; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{ws.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                                {ws.members?.length || 0} member{ws.members?.length !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        {currentWorkspace?.id === ws.id && (
                                            <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <hr className="border-gray-200 dark:border-zinc-700" />

                        <div className="p-2">
                            <button
                                onClick={() => { setShowCreate(true); setIsOpen(false); }}
                                className="flex items-center text-xs gap-2 my-1 w-full px-2 py-1.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500"
                            >
                                <Plus className="w-4 h-4" /> Create Workspace
                            </button>
                            {isAdmin && currentWorkspace && (
                                <button
                                    onClick={() => { setShowArchiveConfirm(true); setIsOpen(false); }}
                                    className="flex items-center text-xs gap-2 my-1 w-full px-2 py-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    <Archive className="w-4 h-4" /> Archive this workspace
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-xl relative">
                        <button
                            onClick={() => { setShowCreate(false); setNewName(""); }}
                            className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                            Create Workspace
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                            A workspace groups your projects and team members together.
                        </p>
                        <form onSubmit={handleCreateWorkspace} className="space-y-4">
                            <div className="flex flex-col items-center gap-3 py-2">
                                <div className="relative group">
                                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-800 transition-colors group-hover:border-blue-400">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Plus className="w-6 h-6 text-zinc-400 group-hover:text-blue-500" />
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        title="Select workspace logo"
                                    />
                                    {imagePreview && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                                            className="absolute -top-1 -right-1 bg-zinc-800 text-white rounded-full p-1 shadow-lg hover:bg-zinc-700 border border-zinc-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    {imageFile ? "Logo Selected" : "Upload Logo (Optional)"}
                                </span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Workspace Name
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Acme Corp"
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreate(false); setNewName(""); }}
                                    className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || !newName.trim()}
                                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 flex items-center gap-2"
                                >
                                    {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {isCreating ? "Creating..." : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDeleteDialog
                isOpen={showArchiveConfirm}
                onClose={() => setShowArchiveConfirm(false)}
                onConfirm={handleArchiveWorkspace}
                itemName={currentWorkspace?.name}
                isLoading={isArchiving}
            />
        </>
    );
}

export default WorkspaceDropdown;
