import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import { useOrganizationList } from "@clerk/react";
import { assets } from "../assets/assets";

function WorkspaceDropdown() {
    const { workspaces, currentWorkspace } = useSelector((state) => state.workspace);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { setActive } = useOrganizationList();

    const onSelectWorkspace = (workspaceId) => {
        dispatch(setCurrentWorkspace(workspaceId));
        if (setActive) setActive({ organization: workspaceId });
        setIsOpen(false);
        navigate("/dashboard");
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

                    <div className="p-2 cursor-pointer rounded group hover:bg-gray-100 dark:hover:bg-zinc-800">
                        <a
                            href="https://clerk.com"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center text-xs gap-2 my-1 w-full text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300"
                        >
                            <Plus className="w-4 h-4" /> Create Workspace
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkspaceDropdown;
