import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, CircleCheck, AlertCircle, Loader2, Unlink } from "lucide-react";
import { apiFetch } from "../lib/api";
import toast from "react-hot-toast";

export default function GoogleCalendarConnect() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        fetchStatus();
    }, []);

    useEffect(() => {
        const result = searchParams.get("google");
        if (result === "connected") {
            toast.success("Google Calendar connected!");
            fetchStatus();
            setSearchParams((p) => { p.delete("google"); return p; });
        } else if (result === "error") {
            toast.error("Failed to connect Google Calendar");
            setSearchParams((p) => { p.delete("google"); return p; });
        }
    }, [searchParams]);

    async function fetchStatus() {
        setLoading(true);
        try {
            const data = await apiFetch("/api/auth/google/status");
            setStatus(data);
        } catch {
            setStatus({ connected: false, configured: false });
        } finally {
            setLoading(false);
        }
    }

    async function handleConnect() {
        setConnecting(true);
        try {
            const { url } = await apiFetch("/api/auth/google");
            window.location.href = url;
        } catch {
            toast.error("Could not initiate Google Calendar connection");
            setConnecting(false);
        }
    }

    async function handleDisconnect() {
        setDisconnecting(true);
        try {
            await apiFetch("/api/auth/google/disconnect", { method: "DELETE" });
            toast.success("Google Calendar disconnected");
            setStatus((s) => ({ ...s, connected: false }));
        } catch {
            toast.error("Failed to disconnect");
        } finally {
            setDisconnecting(false);
        }
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 size-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
                    <Calendar className="size-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Google Calendar</h3>
                        {!loading && status?.connected && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                <CircleCheck className="size-3.5" />
                                Connected
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                        When you're assigned a task, a calendar event is automatically created spanning the start and due date — with reminders one day before each.
                    </p>

                    {loading ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <Loader2 className="size-3 animate-spin" />
                            Checking status…
                        </div>
                    ) : !status?.configured ? (
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="size-3.5" />
                            Google Calendar is not configured on this server yet.
                        </div>
                    ) : status?.connected ? (
                        <button
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-60"
                        >
                            {disconnecting ? <Loader2 className="size-3 animate-spin" /> : <Unlink className="size-3" />}
                            Disconnect
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60"
                        >
                            {connecting ? <Loader2 className="size-3 animate-spin" /> : <Calendar className="size-3" />}
                            Connect Google Calendar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
