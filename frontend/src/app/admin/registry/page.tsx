"use client"

import { useEffect, useState } from "react";
import { ShieldAlert, CheckCircle, XCircle, Clock, ChevronRight, Scale, Info } from "lucide-react";
import axios from "axios";

export default function LogicRegistryPage() {
    const [registry, setRegistry] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [regRes, configRes] = await Promise.all([
                axios.get("http://localhost:4000/api/v1/registry"),
                axios.get("http://localhost:4000/api/v1/registry/config")
            ]);
            setRegistry(regRes.data);
            setConfig(configRes.data);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch registry data", err);
            setLoading(false);
        }
    };

    const handleApproval = async (id: string, status: "APPROVED" | "REJECTED") => {
        try {
            await axios.patch(`http://localhost:4000/api/v1/registry/${id}`, {
                status,
                approved_by: "rahman"
            });
            fetchData();
        } catch (err) {
            alert("Action failed. Check console.");
        }
    };

    if (loading) return <div className="p-10 text-slate-400">Loading Governance Protocol...</div>;

    const pending = registry.filter(r => r.approval_status === "PENDING");
    const history = registry.filter(r => r.approval_status !== "PENDING");

    return (
        <div style={{ color: "#e2e8f0", display: "grid", gap: 32, fontFamily: "'JetBrains Mono','Inter',sans-serif" }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 12 }}>
                        <ShieldAlert size={32} color="#f59e0b" />
                        Logic Change Registry
                    </h1>
                    <p style={{ color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>Audit trail and governance for institutional algo weights.</p>
                </div>
                <div style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "12px 20px", borderRadius: 12, display: "flex", gap: 24 }}>
                    <StatItem label="Operational Status" value="SAFE" color="#10b981" />
                    <StatItem label="Pending Approvals" value={pending.length.toString()} color={pending.length > 0 ? "#f59e0b" : "#94a3b8"} />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32 }}>
                
                {/* Main: Pending & History */}
                <div style={{ display: "grid", gap: 32 }}>
                    
                    {/* Pending Section */}
                    <section>
                        <h2 style={{ fontSize: 14, fontWeight: 800, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, marginBottom: 16, textTransform: "uppercase" }}>
                            <Clock size={16} /> Pending System Updates
                        </h2>
                        {pending.length === 0 ? (
                            <div style={{ padding: 40, border: "1px dashed #334155", borderRadius: 16, textAlign: "center", color: "#64748b" }}>
                                No pending changes. System conviction is aligned.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: 16 }}>
                                {pending.map(entry => (
                                    <RegistryCard 
                                        key={entry._id} 
                                        entry={entry} 
                                        isPending={true}
                                        onApprove={() => handleApproval(entry._id, "APPROVED")}
                                        onReject={() => handleApproval(entry._id, "REJECTED")}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* History Section */}
                    <section>
                        <h2 style={{ fontSize: 14, fontWeight: 800, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, marginBottom: 16, textTransform: "uppercase" }}>
                            <CheckCircle size={16} /> Change History
                        </h2>
                        <div style={{ display: "grid", gap: 12 }}>
                            {history.map(entry => (
                                <RegistryCard key={entry._id} entry={entry} isPending={false} />
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar: Current Configuration */}
                <aside>
                    <div style={{ background: "#0a0f18", border: "1px solid #1e293b", borderRadius: 20, padding: 24, position: "sticky", top: 24 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                            <Scale size={20} color="#38bdf8" /> Active System Weights
                        </h2>
                        {config && (
                            <div style={{ display: "grid", gap: 16 }}>
                                <WeightRow label="FII Trend" value={config.weights.fii_score_max} max={25} color="#34d399" />
                                <WeightRow label="DII Flow" value={config.weights.dii_score_max} max={25} color="#60a5fa" />
                                <WeightRow label="OI / PCR" value={config.weights.pcr_score_max} max={25} color="#a78bfa" />
                                <WeightRow label="Delivery" value={config.weights.deliv_score_max} max={25} color="#fbbf24" />
                                <WeightRow label="Fundamentals" value={config.weights.fundamental_score_max} max={25} color="#f87171" />
                                
                                <div style={{ height: 1, background: "#1e293b", margin: "10px 0" }} />
                                
                                <ThresholdRow label="Min Scanner Confidence" value={config.thresholds.scanner_min_confidence} />
                                <ThresholdRow label="Devil Reject Score" value={config.thresholds.da_reject_threshold} />
                            </div>
                        )}
                        <div style={{ marginTop: 24, padding: 16, background: "rgba(56,189,248,0.05)", borderRadius: 12, border: "1px solid rgba(56,189,248,0.1)" }}>
                            <p style={{ fontSize: 11, lineBreak: "anywhere", lineHeight: 1.6, color: "#38bdf8", margin: 0 }}>
                                <Info size={12} style={{ display: "inline", marginRight: 4 }} />
                                Weights are dynamically adjusted by the Trade Autopsy agent based on pattern recognition.
                            </p>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    );
}

function StatItem({ label, value, color }: { label: string, value: string, color: string }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
        </div>
    );
}

function RegistryCard({ entry, isPending, onApprove, onReject }: any) {
    return (
        <div style={{ 
            background: isPending ? "#111827" : "#0a0f18", 
            border: isPending ? "1px solid #3b82f6" : "1px solid #1e293b", 
            borderRadius: 16, 
            padding: 20,
            transition: "all 0.2s"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ padding: "6px 12px", background: "#1e293b", borderRadius: 8, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>
                        {entry.entry_id}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                        {entry.affected_agent.replace('_', ' ').toUpperCase()} • {entry.affected_parameter.split('.').pop()?.replace('_', ' ').toUpperCase()}
                    </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{entry.date} {entry.time}</div>
            </div>

            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#f87171", textDecoration: "line-through", opacity: 0.6 }}>{entry.old_value}</div>
                    <ChevronRight size={20} color="#475569" />
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#34d399" }}>{entry.new_value}</div>
                </div>
                <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" }}>Reasoning</div>
                    <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: 0 }}>{entry.reasoning}</p>
                </div>
            </div>

            {isPending ? (
                <div style={{ display: "flex", gap: 12, borderTop: "1px solid #1e293b", paddingTop: 16 }}>
                    <button 
                        onClick={onApprove}
                        style={{ flex: 1, padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <CheckCircle size={18} /> APPROVE CHANGE
                    </button>
                    <button 
                        onClick={onReject}
                        style={{ padding: "12px 20px", background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 10, fontWeight: 800, cursor: "pointer" }}>
                        REJECT
                    </button>
                </div>
            ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 700, color: entry.approval_status === "APPROVED" ? "#34d399" : "#f87171" }}>
                    {entry.approval_status === "APPROVED" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {entry.approval_status} BY {entry.approved_by?.toUpperCase()}
                </div>
            )}
        </div>
    );
}

function WeightRow({ label, value, max, color }: any) {
    const pct = (value / max) * 100;
    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: "#94a3b8" }}>{label}</span>
                <span style={{ color: "#f1f5f9" }}>{value} / {max}</span>
            </div>
            <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
        </div>
    );
}

function ThresholdRow({ label, value }: any) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: "#64748b" }}>{label}</span>
            <span style={{ color: "#38bdf8" }}>{value}</span>
        </div>
    );
}
