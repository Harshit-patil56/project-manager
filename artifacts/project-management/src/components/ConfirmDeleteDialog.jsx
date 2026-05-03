import { Trash2, X } from "lucide-react";

const ConfirmDeleteDialog = ({ isOpen, onClose, onConfirm, itemName, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/10 flex-shrink-0">
                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Archive Item</h2>
                </div>

                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    Are you sure you want to archive <span className="font-medium text-zinc-900 dark:text-white">"{itemName}"</span>?
                </p>

                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5">
                    It will be moved to Trash and permanently deleted after 30 days. You can restore it anytime from Trash.
                </p>

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                    >
                        {isLoading ? "Archiving..." : "Archive"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteDialog;
