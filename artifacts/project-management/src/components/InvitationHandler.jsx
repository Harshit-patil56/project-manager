import { useEffect, useState } from "react";
import { useOrganizationList } from "@clerk/react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { fetchWorkspaces } from "../features/workspaceSlice";

const InvitationHandler = () => {
    const { userInvitations, isLoaded, setActive } = useOrganizationList({
        userInvitations: {
            status: ["pending"],
        },
    });
    const dispatch = useDispatch();
    const [processedInvitations, setProcessedInvitations] = useState(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!isLoaded || isProcessing) return;

        const pendingInvs = userInvitations.data || [];
        // Filter out invitations we've already tried to process in this session
        const actualPending = pendingInvs.filter(inv => !processedInvitations.has(inv.id));
        
        if (actualPending.length === 0) return;

        // We iterate through pending invitations and show a prompt
        for (const inv of actualPending) {
            const orgName = inv.publicOrganizationData?.name || "a workspace";
            const toastId = `invitation-${inv.id}`;
            
            toast((t) => (
                <div className="flex flex-col gap-3 min-w-[240px] p-1">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-500/10 shrink-0">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Workspace Invitation</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                You've been invited to join <span className="font-medium text-zinc-900 dark:text-white">{orgName}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                setProcessedInvitations(prev => new Set(prev).add(inv.id));
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
                        >
                            Decline
                        </button>
                        <button
                            onClick={async () => {
                                toast.dismiss(t.id);
                                setIsProcessing(true);
                                setProcessedInvitations(prev => new Set(prev).add(inv.id));
                                
                                const loadingToast = toast.loading("Joining workspace...");
                                try {
                                    const membership = await inv.accept();
                                    toast.dismiss(loadingToast);
                                    toast.success(`Welcome to ${orgName}!`);
                                    
                                    // Refresh workspaces in Redux
                                    await dispatch(fetchWorkspaces()).unwrap();
                                    
                                    // Set active organization in Clerk if setActive is available
                                    if (setActive) {
                                        await setActive({ organization: membership.organization.id });
                                    }
                                    
                                    // Clear Clerk ticket from URL if present
                                    const url = new URL(window.location.href);
                                    url.searchParams.delete("__clerk_ticket");
                                    url.searchParams.delete("__clerk_status");
                                    window.history.replaceState({}, document.title, url.pathname + url.search);
                                } catch (err) {
                                    toast.dismiss(loadingToast);
                                    // If it's already accepted, we can just treat it as success or at least don't show error
                                    if (err.errors?.[0]?.code === "invitation_already_accepted" || err.message?.includes("pending")) {
                                        toast.success("You are already a member!");
                                    } else {
                                        toast.error("Failed to join workspace");
                                        console.error("Invitation acceptance failed:", err);
                                        // On error, maybe we want to allow retry later? 
                                        // For now, let's keep it in processed to avoid immediate loop.
                                    }
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-200 dark:shadow-none transition-all active:scale-95"
                        >
                            Accept & Join
                        </button>
                    </div>
                </div>
            ), {
                duration: 15000,
                id: toastId,
            });
        }
    }, [isLoaded, userInvitations.data, dispatch, setActive, isProcessing, processedInvitations]);

    return null;
};

export default InvitationHandler;
