"use client"

import { useEffect, useState, useRef } from "react"
import { getSyncStatus, runSync } from "@/lib/api"
import { toast } from "sonner"

export function SyncMonitor() {
    const [isSyncing, setIsSyncing] = useState(false)
    const prevSyncingRef = useRef(false)
    const hasChecked = useRef(false)
    const AUTO_SYNC_SESSION_KEY = "autoSyncTriggered"

    useEffect(() => {
        if (hasChecked.current) return
        hasChecked.current = true

        const checkAndSync = async () => {
            try {
                const status = await getSyncStatus()
                const autoSyncAlreadyTriggered = typeof window !== "undefined" && sessionStorage.getItem(AUTO_SYNC_SESSION_KEY) === "1"

                if (status.isSyncing) {
                    // Already syncing (e.g. server restarted mid-sync). Prime the ref so
                    // the completion toast fires when it finishes.
                    setIsSyncing(true)
                    prevSyncingRef.current = true
                } else if (status.needsSync && !autoSyncAlreadyTriggered) {
                    // Only auto-sync once per browser session to prevent loops
                    toast.info("Institutional data is stale. Starting background sync...", {
                        description: "Authentic NSE BhavCopy and Upstox data will be fetched.",
                        duration: 15000
                    })
                    setIsSyncing(true)
                    prevSyncingRef.current = true
                    sessionStorage.setItem(AUTO_SYNC_SESSION_KEY, "1")
                    runSync().catch(err => {
                        console.error("[SyncMonitor] Sync failed:", err)
                        toast.error("Background synchronization failed", {
                            description: err.message
                        })
                    })
                }
                // If cooldownActive, data is already fresh — do nothing silently.
            } catch (err) {
                console.error("[SyncMonitor] Error checking sync status:", err)
            }
        }

        checkAndSync()
        
        // Polling loop for syncing status
        const interval = setInterval(async () => {
            try {
                const status = await getSyncStatus()
                setIsSyncing(status.isSyncing)
            } catch (e) {}
        }, 10000)

        return () => clearInterval(interval)
    }, [])

    // Notify other components and show completion toast
    useEffect(() => {
        const event = new CustomEvent('syncStatusChange', { detail: { isSyncing } })
        window.dispatchEvent(event)

        // Detect completion: transition from true -> false
        if (prevSyncingRef.current && !isSyncing) {
            toast.success("Synchronization Complete", {
                description: "Institutional scores and market snapshots have been updated. (Refresh page if new data isn't visible yet)",
                duration: 15000
            })
        }

        prevSyncingRef.current = isSyncing
    }, [isSyncing])

    return null
}
