import { useState, useEffect, useRef, useCallback } from 'react'
import { BellIcon, CheckCheckIcon, CheckSquareIcon, MessageCircleIcon, FlagIcon, AtSignIcon } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

const TYPE_ICONS = {
    TASK_ASSIGNED: CheckSquareIcon,
    COMMENT_ON_TASK: MessageCircleIcon,
    TASK_DONE: FlagIcon,
    MENTION: AtSignIcon,
}

const TYPE_COLORS = {
    TASK_ASSIGNED: 'text-blue-500',
    COMMENT_ON_TASK: 'text-purple-500',
    TASK_DONE: 'text-emerald-500',
    MENTION: 'text-amber-500',
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const containerRef = useRef(null)
    const listRef = useRef(null)
    const navigate = useNavigate()

    const unreadCount = notifications.filter(n => !n.read).length

    const fetchNotifications = useCallback(async (newOffset = 0) => {
        try {
            setLoading(true)
            const data = await apiFetch(`/api/notifications?offset=${newOffset}&limit=15`)
            const notifs = data.notifications || data || []
            if (newOffset === 0) {
                setNotifications(Array.isArray(notifs) ? notifs : [])
            } else {
                setNotifications(prev => [...prev, ...(Array.isArray(notifs) ? notifs : [])])
            }
            setOffset(newOffset + (notifs?.length || 0))
            setHasMore(data.hasMore ?? false)
            setLoading(false)
        } catch (e) { 
            console.error('Notification fetch error:', e)
            setLoading(false) 
        }
    }, [])

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return
        try {
            setLoadingMore(true)
            const data = await apiFetch(`/api/notifications?offset=${offset}&limit=15`)
            const notifs = data.notifications || data || []
            setNotifications(prev => [...prev, ...(Array.isArray(notifs) ? notifs : [])])
            setOffset(offset + (notifs?.length || 0))
            setHasMore(data.hasMore ?? false)
            setLoadingMore(false)
        } catch (e) { 
            console.error('Load more error:', e)
            setLoadingMore(false) 
        }
    }, [offset, hasMore, loadingMore])

    const handleScroll = useCallback(() => {
        if (!listRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = listRef.current
        if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loadingMore) {
            loadMore()
        }
    }, [hasMore, loadingMore, loadMore])

    useEffect(() => {
        // Initial fetch on mount
        fetchNotifications(0)
    }, [])

    useEffect(() => {
        // SSE connection for real-time (only when open)
        if (!open) return
        
        const es = new EventSource('/api/notifications/events')
        es.onmessage = (e) => {
            try {
                const newNotif = JSON.parse(e.data)
                setNotifications(prev => [newNotif, ...prev])
            } catch { }
        }
        es.onerror = () => es.close()
        return () => es.close()
    }, [open])

    useEffect(() => {
        if (open) {
            fetchNotifications(0)
        }
    }, [open])

    useEffect(() => {
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const markAllRead = async () => {
        try {
            await apiFetch('/api/notifications/read-all', { method: 'PATCH' })
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        } catch { /* silent */ }
    }

    const handleClick = async (notification) => {
        if (!notification.read) {
            try {
                await apiFetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' })
                setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
            } catch { /* silent */ }
        }
        setOpen(false)
        if (notification.taskId && notification.projectId) {
            navigate(`/taskDetails?projectId=${notification.projectId}&taskId=${notification.taskId}`)
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen(o => !o)}
                className="relative size-8 flex items-center justify-center bg-white dark:bg-zinc-800 shadow rounded-lg transition hover:scale-105 active:scale-95"
            >
                <BellIcon className="size-4 text-gray-700 dark:text-gray-200" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                            >
                                <CheckCheckIcon className="size-3" /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div ref={listRef} className="max-h-96 overflow-y-auto" onScroll={handleScroll}>
                        {notifications.length === 0 && !loading ? (
                            <div className="py-10 text-center">
                                <BellIcon className="size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                                <p className="text-sm text-zinc-400 dark:text-zinc-500">All caught up!</p>
                            </div>
                        ) : (
                            <>
                                {notifications.map(n => {
                                    const Icon = TYPE_ICONS[n.type] ?? BellIcon
                                    const iconColor = TYPE_COLORS[n.type] ?? 'text-zinc-400'
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => handleClick(n)}
                                            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-50 dark:border-zinc-800/60 ${
                                                n.read
                                                    ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                                                    : 'bg-blue-50/50 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                                            }`}
                                        >
                                            <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                                                <Icon className="size-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm truncate ${n.read ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200 font-medium'}`}>
                                                    {n.title}
                                                </p>
                                                {n.body && (
                                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{n.body}</p>
                                                )}
                                                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                            {!n.read && (
                                                <span className="mt-1.5 size-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                            )}
                                        </button>
                                    )
                                })}
                                {loadingMore && (
                                    <>
                                        {[...Array(3)].map((_, i) => (
                                            <div key={`skeleton-${i}`} className="flex items-start gap-3 px-4 py-3 border-b border-zinc-50 dark:border-zinc-800/60 animate-pulse">
                                                <div className="mt-0.5 size-4 rounded bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
                                                    <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                                                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded w-1/4" />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
