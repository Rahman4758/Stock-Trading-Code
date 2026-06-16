"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Info } from "lucide-react"

interface InfoTooltipProps {
    title?: string;
    content: React.ReactNode;
    size?: number;
    color?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, content, size = 14, color = "#64748b" }) => {
    const [isOpen, setIsOpen] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)

    // Handle outside click to close on mobile
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    return (
        <div 
            className="relative inline-flex items-center" 
            ref={tooltipRef}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onClick={() => setIsOpen(!isOpen)}
            style={{ cursor: "pointer", marginLeft: 6 }}
        >
            <Info size={size} color={isOpen ? "#38bdf8" : color} style={{ transition: "color 0.2s" }} />

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        style={{
                            position: "absolute",
                            bottom: "100%", // pop upwards
                            left: "50%",
                            transform: "translateX(-50%)",
                            marginBottom: 8, // gap
                            width: "max-content",
                            maxWidth: 320,
                            background: "rgba(15, 23, 42, 0.95)",
                            backdropFilter: "blur(16px)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 12,
                            padding: "12px 16px",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(56, 189, 248, 0.1)",
                            zIndex: 100,
                            pointerEvents: "none", // Prevent flickering when moving mouse slightly off icon
                        }}
                    >
                        {/* Triangle pointer */}
                        <div style={{
                            position: "absolute",
                            bottom: -5,
                            left: "50%",
                            marginLeft: -5,
                            width: 10,
                            height: 10,
                            background: "rgba(15, 23, 42, 0.95)",
                            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                            transform: "rotate(45deg)",
                            zIndex: -1
                        }} />

                        {title && (
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#38bdf8", marginBottom: 6 }}>
                                {title}
                            </div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: "#cbd5e1", whiteSpace: "normal" }}>
                            {content}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
