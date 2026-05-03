import { useState, useEffect } from "react";
import { Copy, Check, Github, ExternalLink } from "lucide-react";
import { apiFetch } from "../lib/api";
import toast from "react-hot-toast";

export default function GitHubIntegration({ project }) {
    const [githubRepo, setGithubRepo] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);

    const webhookUrl = `${window.location.origin}/api/github/webhook`;

    useEffect(() => {
        if (!project?.id) return;
        apiFetch(`/api/projects/${project.id}/github-config`)
            .then((data) => {
                setGithubRepo(data.githubRepo || "");
                setWebhookSecret(data.githubWebhookSecret || "");
            })
            .catch(() => {});
    }, [project?.id]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data = await apiFetch(`/api/projects/${project.id}/github-config`, {
                method: "PATCH",
                body: JSON.stringify({ githubRepo }),
            });
            setWebhookSecret(data.githubWebhookSecret);
            toast.success("GitHub integration saved");
        } catch (err) {
            toast.error(err?.message || "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = async (text, setter) => {
        await navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
    };

    const inputClasses = "w-full px-3 py-2 rounded mt-2 border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300";
    const labelClasses = "text-sm text-zinc-600 dark:text-zinc-400";

    return (
        <div className="rounded-lg border p-6 not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border-zinc-300 dark:border-zinc-800 space-y-5">
            <div className="flex items-center gap-2">
                <Github className="size-5 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300">GitHub Integration</h2>
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Link a GitHub repository to this project. Include a task key like{" "}
                <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-mono text-xs">
                    {project?.slug || "TEST"}-1
                </code>{" "}
                in your commit messages to automatically link commits to tasks.
            </p>

            <div className="space-y-2">
                <label className={labelClasses}>Repository URL</label>
                <div className="flex gap-2">
                    <input
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        className={inputClasses + " flex-1 mt-0"}
                    />
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {webhookSecret && (
                <>
                    <div className="space-y-2">
                        <label className={labelClasses}>Webhook Secret <span className="text-xs">(paste this into GitHub)</span></label>
                        <div className="flex gap-2 mt-2">
                            <input
                                readOnly
                                value={webhookSecret}
                                className={inputClasses + " flex-1 mt-0 font-mono text-xs"}
                            />
                            <button
                                onClick={() => copyToClipboard(webhookSecret, setCopiedSecret)}
                                className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                title="Copy secret"
                            >
                                {copiedSecret ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-zinc-500" />}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Setup instructions</p>
                        <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal pl-4">
                            <li>Go to your GitHub repository → Settings → Webhooks → Add webhook</li>
                            <li>
                                <span>Set the Payload URL to:</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="flex-1 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs break-all text-zinc-700 dark:text-zinc-300">{webhookUrl}</code>
                                    <button
                                        onClick={() => copyToClipboard(webhookUrl, setCopied)}
                                        className="flex-shrink-0 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-zinc-500" />}
                                    </button>
                                </div>
                            </li>
                            <li>Set Content type to <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">application/json</code></li>
                            <li>Paste the webhook secret above into the Secret field</li>
                            <li>Select <strong>Just the push event</strong></li>
                            <li>Click Add webhook</li>
                        </ol>
                        {githubRepo && (
                            <a
                                href={`${githubRepo}/settings/hooks`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
                            >
                                Open GitHub webhook settings <ExternalLink className="size-3" />
                            </a>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
