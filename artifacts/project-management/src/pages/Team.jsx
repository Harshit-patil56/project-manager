import { useEffect, useState } from "react";
import { UsersIcon, Search, UserPlus, Shield, Activity, BarChart2Icon } from "lucide-react";
import InviteMemberDialog from "../components/InviteMemberDialog";
import { useSelector } from "react-redux";
import { useOrganization } from "@clerk/react";

const PRIORITY_COLORS = {
    HIGH: { bar: "bg-red-500", label: "text-red-500" },
    MEDIUM: { bar: "bg-amber-400", label: "text-amber-500" },
    LOW: { bar: "bg-zinc-400", label: "text-zinc-400" },
};

function WorkloadBar({ count, max }) {
    const pct = max > 0 ? Math.min(100, (count / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 w-4 text-right">{count}</span>
        </div>
    );
}

const Team = () => {

    const [tasks, setTasks] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);
    const projects = currentWorkspace?.projects || [];

    const { memberships } = useOrganization({ memberships: {} });
    const clerkMembers = memberships?.data ?? [];

    useEffect(() => {
        setTasks(currentWorkspace?.projects?.reduce((acc, project) => [...acc, ...project.tasks], []) || []);
    }, [currentWorkspace]);

    const members = clerkMembers.map((m) => {
        const firstName = m.publicUserData?.firstName ?? "";
        const lastName = m.publicUserData?.lastName ?? "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        const email = m.publicUserData?.identifier ?? "";
        const name = fullName || email || "Unknown";
        const image = m.publicUserData?.imageUrl ?? "";
        const role = m.role === "org:admin" ? "ADMIN" : "MEMBER";
        const userId = m.publicUserData?.userId ?? m.id;
        return { id: m.id, userId, name, email, image, role };
    });

    const filteredMembers = members.filter(
        (m) =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Workload computation
    const openTasks = tasks.filter(t => t.status !== "DONE" && !t.deletedAt);
    const workloadMap = {};
    for (const member of members) {
        workloadMap[member.userId] = { HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 };
    }
    for (const task of openTasks) {
        if (task.assigneeId && workloadMap[task.assigneeId] !== undefined) {
            const p = task.priority || "LOW";
            workloadMap[task.assigneeId][p] = (workloadMap[task.assigneeId][p] || 0) + 1;
            workloadMap[task.assigneeId].total += 1;
        }
    }
    const maxWorkload = Math.max(1, ...Object.values(workloadMap).map(w => w.total));
    const membersWithWork = members.filter(m => workloadMap[m.userId]?.total > 0)
        .sort((a, b) => (workloadMap[b.userId]?.total ?? 0) - (workloadMap[a.userId]?.total ?? 0));

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">Team</h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Manage team members and their contributions
                    </p>
                </div>
                <button onClick={() => setIsDialogOpen(true)} className="flex items-center px-5 py-2 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white transition" >
                    <UserPlus className="w-4 h-4 mr-2" /> Invite Member
                </button>
                <InviteMemberDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* Stats Cards */}
            <div className="flex flex-wrap gap-4">
                <div className="max-sm:w-full dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-gray-300 dark:border-zinc-800 rounded-lg p-6">
                    <div className="flex items-center justify-between gap-8 md:gap-22">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">Total Members</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{members.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-500/10">
                            <UsersIcon className="size-4 text-blue-500 dark:text-blue-200" />
                        </div>
                    </div>
                </div>

                <div className="max-sm:w-full dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-gray-300 dark:border-zinc-800 rounded-lg p-6">
                    <div className="flex items-center justify-between gap-8 md:gap-22">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">Active Projects</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {projects.filter((p) => p.status !== "CANCELLED" && p.status !== "COMPLETED").length}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10">
                            <Activity className="size-4 text-emerald-500 dark:text-emerald-200" />
                        </div>
                    </div>
                </div>

                <div className="max-sm:w-full dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-gray-300 dark:border-zinc-800 rounded-lg p-6">
                    <div className="flex items-center justify-between gap-8 md:gap-22">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">Total Tasks</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{tasks.length}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-500/10">
                            <Shield className="size-4 text-purple-500 dark:text-purple-200" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 size-3" />
                <input placeholder="Search team members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full text-sm rounded-md border border-gray-300 dark:border-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 py-2 focus:outline-none focus:border-blue-500" />
            </div>

            {/* Team Members */}
            <div className="w-full">
                {filteredMembers.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <UsersIcon className="w-12 h-12 text-gray-400 dark:text-zinc-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {members.length === 0 ? "No team members yet" : "No members match your search"}
                        </h3>
                        <p className="text-gray-500 dark:text-zinc-400 mb-6">
                            {members.length === 0 ? "Invite team members to start collaborating" : "Try adjusting your search term"}
                        </p>
                    </div>
                ) : (
                    <div className="max-w-4xl w-full">
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto rounded-md border border-gray-200 dark:border-zinc-800">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                                <thead className="bg-gray-50 dark:bg-zinc-900/50">
                                    <tr>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">Name</th>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">Email</th>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {filteredMembers.map((member) => (
                                        <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-2.5 whitespace-nowrap flex items-center gap-3">
                                                {member.image ? (
                                                    <img
                                                        src={member.image}
                                                        alt={member.name}
                                                        className="size-7 rounded-full bg-gray-200 dark:bg-zinc-800 object-cover"
                                                    />
                                                ) : (
                                                    <div className="size-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-sm text-zinc-800 dark:text-white truncate">
                                                    {member.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                                                {member.email}
                                            </td>
                                            <td className="px-6 py-2.5 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded-md ${member.role === "ADMIN"
                                                    ? "bg-purple-100 dark:bg-purple-500/20 text-purple-500 dark:text-purple-400"
                                                    : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"}`}>
                                                    {member.role}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden space-y-3">
                            {filteredMembers.map((member) => (
                                <div key={member.id} className="p-4 border border-gray-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900">
                                    <div className="flex items-center gap-3 mb-2">
                                        {member.image ? (
                                            <img
                                                src={member.image}
                                                alt={member.name}
                                                className="size-9 rounded-full bg-gray-200 dark:bg-zinc-800 object-cover"
                                            />
                                        ) : (
                                            <div className="size-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                                {member.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-zinc-400">{member.email}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-md ${member.role === "ADMIN"
                                        ? "bg-purple-100 dark:bg-purple-500/20 text-purple-500 dark:text-purple-400"
                                        : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"}`}>
                                        {member.role}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Workload Section */}
            {openTasks.length > 0 && (
                <div className="space-y-4 max-w-4xl">
                    <div className="flex items-center gap-2">
                        <BarChart2Icon className="size-4 text-zinc-500 dark:text-zinc-400" />
                        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Workload</h2>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">— open tasks per member</span>
                    </div>

                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        {members.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-zinc-400 dark:text-zinc-500 text-center">No members yet</div>
                        ) : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {/* Header */}
                                <div className="hidden sm:grid grid-cols-[200px_1fr_80px_80px_80px_80px] px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    <span>Member</span>
                                    <span>Open Tasks</span>
                                    <span className="text-right text-red-500">High</span>
                                    <span className="text-right text-amber-500">Medium</span>
                                    <span className="text-right text-zinc-400">Low</span>
                                    <span className="text-right">Total</span>
                                </div>
                                {members
                                    .slice()
                                    .sort((a, b) => (workloadMap[b.userId]?.total ?? 0) - (workloadMap[a.userId]?.total ?? 0))
                                    .map(member => {
                                        const wl = workloadMap[member.userId] ?? { HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 };
                                        return (
                                            <div key={member.id} className="px-4 py-3 flex flex-col sm:grid sm:grid-cols-[200px_1fr_80px_80px_80px_80px] items-center gap-2">
                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                    {member.image ? (
                                                        <img src={member.image} alt={member.name} className="size-6 rounded-full object-cover flex-shrink-0" />
                                                    ) : (
                                                        <div className="size-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                                                            {member.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]">{member.name}</span>
                                                </div>
                                                <WorkloadBar count={wl.total} max={maxWorkload} />
                                                <span className="hidden sm:block text-right text-xs text-red-500 font-medium">{wl.HIGH}</span>
                                                <span className="hidden sm:block text-right text-xs text-amber-500 font-medium">{wl.MEDIUM}</span>
                                                <span className="hidden sm:block text-right text-xs text-zinc-400 font-medium">{wl.LOW}</span>
                                                <span className="hidden sm:block text-right text-xs text-zinc-700 dark:text-zinc-300 font-semibold">{wl.total}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    {/* Priority legend */}
                    <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500 inline-block" />High</span>
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400 inline-block" />Medium</span>
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-zinc-400 inline-block" />Low</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Team;
