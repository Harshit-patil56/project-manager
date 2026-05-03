import { SearchIcon, PanelLeft, FolderKanban, CheckSquare, Users } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useDispatch, useSelector } from 'react-redux'
import { toggleTheme } from '../features/themeSlice'
import { MoonIcon, SunIcon } from 'lucide-react'
import { UserButton } from '@clerk/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { useNavigate } from 'react-router-dom'

function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}

const STATUS_COLORS = {
    TODO: 'bg-zinc-400',
    IN_PROGRESS: 'bg-blue-500',
    DONE: 'bg-emerald-500',
    PLANNING: 'bg-zinc-400',
    ACTIVE: 'bg-emerald-500',
    ON_HOLD: 'bg-amber-400',
    COMPLETED: 'bg-blue-500',
    CANCELLED: 'bg-red-500',
}

const PRIORITY_COLORS = {
    HIGH: 'text-red-500',
    MEDIUM: 'text-amber-500',
    LOW: 'text-zinc-400',
}

export default function Navbar({ setIsSidebarOpen }) {
    const dispatch = useDispatch()
    const { theme } = useSelector(state => state.theme)
    const navigate = useNavigate()

    const [query, setQuery] = useState('')
    const [results, setResults] = useState(null)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const containerRef = useRef(null)
    const debouncedQuery = useDebounce(query, 220)

    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setResults(null)
            setOpen(false)
            return
        }
        setLoading(true)
        apiFetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
            .then(data => {
                setResults(data)
                setOpen(true)
            })
            .catch(() => setResults(null))
            .finally(() => setLoading(false))
    }, [debouncedQuery])

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }

    const handleResultClick = useCallback((type, item) => {
        setOpen(false)
        setQuery('')
        setResults(null)
        if (type === 'task') {
            navigate(`/taskDetails?projectId=${item.projectId}&taskId=${item.id}`)
        } else if (type === 'project') {
            navigate(`/projects?id=${item.id}`)
        } else if (type === 'member') {
            navigate('/team')
        }
    }, [navigate])

    const hasResults = results && (results.tasks?.length > 0 || results.projects?.length > 0 || results.members?.length > 0)

    return (
        <div className="w-full bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 xl:px-16 py-3 flex-shrink-0">
            <div className="flex items-center justify-between max-w-6xl mx-auto">
                {/* Left */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <button onClick={() => setIsSidebarOpen(prev => !prev)} className="sm:hidden p-2 rounded-lg transition-colors text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800">
                        <PanelLeft size={20} />
                    </button>

                    {/* Search */}
                    <div className="relative flex-1 max-w-sm" ref={containerRef}>
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-400 size-3.5 pointer-events-none z-10" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onFocus={() => { if (results && query.trim()) setOpen(true) }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search projects, tasks, people..."
                            className="pl-8 pr-4 py-2 w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                        />

                        {/* Dropdown */}
                        {open && query.trim() && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                                {loading && (
                                    <div className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">Searching…</div>
                                )}

                                {!loading && !hasResults && (
                                    <div className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">No results for "{query}"</div>
                                )}

                                {!loading && hasResults && (
                                    <div className="py-1 max-h-80 overflow-y-auto">
                                        {results.tasks?.length > 0 && (
                                            <>
                                                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                                                    <CheckSquare className="size-3" /> Tasks
                                                </div>
                                                {results.tasks.map(task => (
                                                    <button
                                                        key={task.id}
                                                        onClick={() => handleResultClick('task', task)}
                                                        className="w-full px-3 py-2 flex items-start gap-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                                    >
                                                        <span className={`mt-1.5 size-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[task.status] ?? 'bg-zinc-400'}`} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{task.title}</p>
                                                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                                                {task.projectName}
                                                                {task.taskNumber ? ` · #${task.taskNumber}` : ''}
                                                                {task.priority && <span className={` · ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {results.projects?.length > 0 && (
                                            <>
                                                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                                                    <FolderKanban className="size-3" /> Projects
                                                </div>
                                                {results.projects.map(project => (
                                                    <button
                                                        key={project.id}
                                                        onClick={() => handleResultClick('project', project)}
                                                        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                                    >
                                                        <span className={`size-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[project.status] ?? 'bg-zinc-400'}`} />
                                                        <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{project.name}</p>
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {results.members?.length > 0 && (
                                            <>
                                                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                                                    <Users className="size-3" /> People
                                                </div>
                                                {results.members.map(member => (
                                                    <button
                                                        key={member.id}
                                                        onClick={() => handleResultClick('member', member)}
                                                        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                                    >
                                                        {member.image ? (
                                                            <img src={member.image} alt={member.name} className="size-5 rounded-full flex-shrink-0 object-cover" />
                                                        ) : (
                                                            <div className="size-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0">
                                                                {member.name?.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{member.name}</p>
                                                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{member.email}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <button onClick={() => dispatch(toggleTheme())} className="size-8 flex items-center justify-center bg-white dark:bg-zinc-800 shadow rounded-lg transition hover:scale-105 active:scale-95">
                        {theme === 'light'
                            ? <MoonIcon className="size-4 text-gray-800 dark:text-gray-200" />
                            : <SunIcon className="size-4 text-yellow-400" />
                        }
                    </button>
                    <UserButton />
                </div>
            </div>
        </div>
    )
}
