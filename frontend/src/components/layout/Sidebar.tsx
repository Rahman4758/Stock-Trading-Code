"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
    Activity,
    BookOpen,
    CandlestickChart,
    Eye,
    Layers,
    LineChart,
    PieChart,
    Radar,
    RefreshCcw,
    Settings,
    ShieldAlert,
    TrendingUp,
} from "lucide-react"
import { runSync, getSyncStatus } from "@/lib/api"
import { toast } from "sonner"

const sidebarItems = [
    { title: "Market Scan",     href: "/",               icon: TrendingUp },
    { title: "Sector Radar",    href: "/sectors",        icon: LineChart },
    { title: "Money Flow",      href: "/money-flow",     icon: CandlestickChart },
    { title: "Event Radar",     href: "/event-radar",    icon: Radar },
    { title: "Strategy Vault",  href: "/strategies",     icon: Layers },
    { title: "AI Watchlist",    href: "/watchlist",      icon: Eye },
    { title: "Portfolio",       href: "/portfolio",      icon: PieChart },
    { title: "Trade Journal",   href: "/journal",        icon: BookOpen },
    { title: "Active Radar",    href: "/radar",          icon: Activity },
    { title: "Logic Registry",  href: "/admin/registry", icon: ShieldAlert },
    { title: "Settings",        href: "/settings",       icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()
    const [isSyncing, setIsSyncing] = useState(false)
    const [isManualSyncing, setIsManualSyncing] = useState(false)

    useEffect(() => {
        const handleSync = (e: any) => setIsSyncing(e.detail.isSyncing)
        window.addEventListener('syncStatusChange', handleSync)
        return () => window.removeEventListener('syncStatusChange', handleSync)
    }, [])

    const handleManualSync = async () => {
        if (isSyncing || isManualSyncing) return
        
        setIsManualSyncing(true)

        try {
            // Check status first — if already synced today, skip the pipeline entirely
            const status = await getSyncStatus()

            if (status.cooldownActive && !status.needsSync) {
                toast.success("Data already fetched successfully", {
                    description: `Last sync: ${status.lastSync?.timestamp ? new Date(status.lastSync.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'recently'}. All institutional data is current.`,
                    duration: 8000
                })
                return
            }

            toast.info("Manual synchronization triggered", {
                description: "Establishing connection to institutional data sources...",
                duration: 15000
            })
            
            const result = await runSync()

            // Backend returned early — data already up to date
            if ((result as any)?.alreadySynced) {
                toast.success("Data already fetched successfully", {
                    description: "All institutional data is current. No new sync required.",
                    duration: 8000
                })
            }
        } catch (err: any) {
            toast.error("Failed to start synchronization", {
                description: err.response?.data?.message || err.message
            })
        } finally {
            setIsManualSyncing(false)
        }
    }

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: 240,
            flexShrink: 0,
            background: "rgba(9,13,31,0.95)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(24px)",
            fontFamily: "'DM Sans','Inter',sans-serif",
            position: "relative",
            zIndex: 10,
        }}>

            {/* Subtle ambient glow top-left */}
            <div style={{ position: "absolute", top: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.06) 0%,transparent 70%)", pointerEvents: "none" }} />

            {/* Logo */}
            <div style={{ padding: "28px 20px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, backgroundImage: "linear-gradient(135deg,#6366f1,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>
                        <TrendingUp size={15} color="#fff" />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", backgroundImage: "linear-gradient(90deg,#f1f5f9,#94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        InstiEdge
                    </span>
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: isSyncing ? "#f59e0b" : "#34d399", boxShadow: `0 0 6px ${isSyncing ? "#f59e0b" : "#34d399"}`, animation: isSyncing ? "pulse 1.5s infinite" : "none" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: isSyncing ? "#f59e0b" : "#94a3b8" }}>
                            {isSyncing ? "Syncing" : "Live"}
                        </span>
                    </div>
                    <button 
                        onClick={handleManualSync}
                        disabled={isSyncing || isManualSyncing}
                        style={{ 
                            background: "transparent", 
                            border: "none", 
                            color: "#94a3b8", 
                            cursor: (isSyncing || isManualSyncing) ? "not-allowed" : "pointer", 
                            display: "flex", 
                            alignItems: "center", 
                            padding: 4,
                            borderRadius: 6,
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={e => !isSyncing && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        title="Trigger Manual Sync"
                    >
                        <RefreshCcw size={12} className={cn((isSyncing || isManualSyncing) && "animate-spin")} />
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Divider */}
            <div style={{ margin: "0 20px 12px", height: 1, background: "rgba(255,255,255,0.05)" }} />

            {/* Nav */}
            <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {sidebarItems.map((item) => {
                    const active = pathname === item.href
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn()} // preserving cn import usage
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 12,
                                fontSize: 13,
                                fontWeight: active ? 700 : 500,
                                textDecoration: "none",
                                transition: "all 0.15s",
                                position: "relative",
                                ...(active ? {
                                    background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(56,189,248,0.12))",
                                    border: "1px solid rgba(99,102,241,0.25)",
                                    color: "#e2e8f0",
                                } : {
                                    background: "transparent",
                                    border: "1px solid transparent",
                                    color: "#94a3b8",
                                })
                            }}
                            onMouseEnter={e => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
                                    ;(e.currentTarget as HTMLElement).style.color = "#94a3b8"
                                    ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"
                                }
                            }}
                            onMouseLeave={e => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.background = "transparent"
                                    ;(e.currentTarget as HTMLElement).style.color = "#94a3b8"
                                    ;(e.currentTarget as HTMLElement).style.borderColor = "transparent"
                                }
                            }}
                        >
                            {/* Active indicator bar */}
                            {active && (
                                <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: "0 3px 3px 0", backgroundImage: "linear-gradient(180deg,#6366f1,#38bdf8)" }} />
                            )}
                            <div style={{
                                width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                background: active ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                                border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.05)",
                            }}>
                                <Icon size={13} color={active ? "#818cf8" : "#94a3b8"} />
                            </div>
                            {item.title}
                        </Link>
                    )
                })}
            </nav>

            {/* Divider */}
            <div style={{ margin: "0 20px 12px", height: 1, background: "rgba(255,255,255,0.05)" }} />

            {/* User footer */}
            <div style={{ padding: "12px 20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundImage: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(56,189,248,0.3))", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#818cf8" }}>US</span>
                    </div>
                    <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>User</p>
                        <p style={{ fontSize: 10, color: "#64748b", margin: 0, fontWeight: 700 }}>Pro Plan</p>
                    </div>
                    <div style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 6, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", fontSize: 9, fontWeight: 700, color: "#34d399", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        PRO
                    </div>
                </div>
            </div>

        </div>
    )
}