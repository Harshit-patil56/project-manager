import { Github, Plug } from "lucide-react";
import GoogleCalendarConnect from "../components/GoogleCalendarConnect";

export default function IntegrationsPage() {
    return (
        <div className="max-w-2xl mx-auto py-10 px-4">
            <div className="flex items-center gap-2 mb-1">
                <Plug className="size-5 text-zinc-500" />
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Integrations</h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                Connect external services to sync your work automatically.
            </p>

            <div className="space-y-4">
                <GoogleCalendarConnect />

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 size-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                            <Github className="size-5 text-zinc-700 dark:text-zinc-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-0.5">GitHub</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Connect your repository to auto-link commits to tasks. Configure per-project in Project Settings.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
