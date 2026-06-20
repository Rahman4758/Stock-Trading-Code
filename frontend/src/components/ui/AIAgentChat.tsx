"use client"

import { useState, useEffect, useRef } from "react"
import { chatWithAI } from "@/lib/api"
import { Bot, Send, User, Sparkles, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"

interface Message {
    role: "user" | "expert";
    content: string;
}

export default function AIAgentChat({ symbol, contextData }: { symbol: string, contextData: any }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [initialFetchDone, setInitialFetchDone] = useState(false)
    const endOfMessagesRef = useRef<HTMLDivElement>(null)

    // Auto-scroll
    useEffect(() => {
        if (messages.length > 0 || loading) {
            endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, loading])

    const handleInitialAnalysis = async () => {
        if (!symbol || !contextData || loading) return;
        
        setLoading(true)
        try {
            const pruneContext = {
                priceAction: contextData.stock ? { price: contextData.stock.currentPrice, active: contextData.stock.isActive } : null,
                latestFootprint: contextData.chartData ? contextData.chartData.slice(-5) : null,
                analysis: contextData.analysis ? contextData.analysis.preTradeChecklist : null,
                scores: contextData.analysis ? contextData.analysis.scores : null
            }
            
            const res = await chatWithAI(symbol, pruneContext, "");
            setMessages([{ role: "expert", content: res.reply }])
            setInitialFetchDone(true)
        } catch (err) {
            setMessages([{ role: "expert", content: "Failed to connect to Institutional AI Agent. Please try again later." }])
        } finally {
            setLoading(false)
        }
    }

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        
        const userMsg = input.trim();
        setInput("");
        const newHistory: Message[] = [...messages, { role: "user", content: userMsg }];
        setMessages(newHistory);
        setLoading(true);

        try {
            const pruneContext = {
                priceAction: contextData.stock ? { price: contextData.stock.currentPrice } : null,
                latestFootprint: contextData.chartData ? contextData.chartData.slice(-5) : null
            }
            
            const res = await chatWithAI(symbol, pruneContext, userMsg, messages);
            setMessages(prev => [...prev, { role: "expert", content: res.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: "expert", content: "Sorry, I encountered an error analyzing the request." }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-[600px] w-full rounded-2xl bg-[#0b1120] border border-slate-800/60 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <Bot className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            Institutional Expert AI
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        </h3>
                        <p className="text-xs text-slate-400">Analyzing {symbol} footprint data</p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                {messages.length === 0 && loading && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <p className="text-sm">Synthesizing footprint data for {symbol}...</p>
                    </div>
                )}

                {messages.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6">
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Bot className="w-8 h-8 text-blue-400" />
                        </div>
                        <div className="text-center">
                            <h4 className="text-white font-medium mb-2">Expert AI Analysis</h4>
                            <p className="text-sm text-slate-500 max-w-sm mb-6">
                                Click below to generate an institutional-grade analysis on the footprint data, option chain, and delivery percentage for {symbol}.
                            </p>
                            <button
                                onClick={handleInitialAnalysis}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 mx-auto"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate AI Analysis
                            </button>
                        </div>
                    </div>
                )}
                
                {messages.map((msg, idx) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={idx} 
                        className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                            msg.role === 'user' 
                                ? 'bg-indigo-500/10 border border-indigo-500/20 text-slate-200 rounded-tr-sm' 
                                : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 rounded-tl-sm'
                        }`}>
                            <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-sm max-w-none">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    </motion.div>
                ))}
                
                {loading && messages.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500/50 animate-bounce"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-500/50 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-blue-500/50 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </motion.div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-800/60 bg-slate-900/30">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-3 bg-slate-950/50 border border-slate-800 rounded-xl p-2 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all"
                >
                    <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={loading}
                        placeholder="Ask the expert about order flow, targets, or risk..."
                        className="flex-1 bg-transparent border-none outline-none text-sm text-white px-2 placeholder:text-slate-600 disabled:opacity-50"
                    />
                    <button 
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    )
}
