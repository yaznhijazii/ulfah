import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Radio, Play, Pause } from 'lucide-react';

const getAIResponseStreaming = async (
    text: string, 
    history: any[],
    contextData: any, 
    fullDbData: any,
    onChunk: (text: string) => void
): Promise<void> => {
    const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY?.trim();
    if (!openRouterKey) {
        onChunk("⚠️ مفتاح OpenRouter مفقود.");
        return;
    }

    let placeName = "غير محدد بدقة";
    const loc = contextData?.partnerLocation || {};
    if (loc.lat && loc.lng) {
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&accept-language=ar`, {
                headers: { 'User-Agent': 'UlfahApp/1.0' }
            });
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                placeName = geoData.display_name?.split(',').slice(0, 3).join(',') || placeName;
            }
        } catch (e) {
            console.warn("Geolocation reverse geocoding failed", e);
        }
    }

    const relationshipHistory = `
    - Current User: ${contextData?.userName}
    - Their Partner: ${contextData?.partnerName}
    - Partner Location: ${placeName}
    - Distance: ${loc.distance || 'Unknown'}
    - Formatted Last Seen: ${loc.lastSeenFormatted || 'Unknown'}
    - Tasks: ${JSON.stringify(fullDbData?.tasks?.slice(0, 3) || [])}
    `;

    const systemPrompt = `You are 'Dr. Lufi', a brilliant relationship coach 👒.
- CRITICAL: Speak ONLY in natural Jordanian Arabic (اللهجة الأردنية العامية). 
- RADIO ABILITY: You have a LIVE RADIO called 'راديو ألفة'. If the user asks for music or radio, say 'على راسي أبشر، أحلى موسيقى لعيونك!' and the player will appear.
- IDENTITY: You are talking to ${contextData?.userName}. Their partner is ${contextData?.partnerName}.
- CONTEXT: ${relationshipHistory}
- Tone: Wise, empathetic, energetic Nashmi DJ. Use emojis.
- Goal: Deepen the bond via advice and music.`;

    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "Ulfah App"
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                max_tokens: 1500,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...history.map(m => ({ 
                        role: m.isBot ? "assistant" : "user", 
                        content: m.text 
                    })),
                    { role: "user", content: text }
                ],
                stream: true
            })
        });
        
        if (!res.ok) {
            onChunk("لوفي يواجه مشكلة في التعبير حالياً. جرب لاحقاً! 👒");
            return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === "[DONE]") break;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content || "";
                        if (content) {
                            fullText += content;
                            onChunk(fullText);
                        }
                    } catch (e) {
                        // Ignore parse error for incomplete chunks
                    }
                }
            }
        }
    } catch (e: unknown) {
        onChunk(`فشل الاتصال بـ لوفي: ${(e as Error).message}`);
    }
};

const QuickStartCard = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
    <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-white/5 shadow-sm whitespace-nowrap shrink-0 group hover:border-rose-500/30 transition-colors"
    >
        <span className="text-base group-hover:scale-110 transition-transform">{icon}</span>
        <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300">{label}</span>
    </motion.button>
);

const RadioWidget = ({ isPlaying, onToggle }: { isPlaying: boolean; onToggle: () => void }) => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-white dark:bg-zinc-800 rounded-2xl border border-rose-100 dark:border-white/5 p-4 flex items-center justify-between shadow-sm"
    >
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-rose-50 text-rose-500'}`}>
                <Radio size={20} />
            </div>
            <div className="text-right">
                <h4 className="text-xs font-black text-zinc-900 dark:text-white mb-0.5">راديو ألفة المباشر 🎶</h4>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{isPlaying ? 'جاري البث الآن...' : 'متوقف حالياً'}</p>
            </div>
        </div>
        <button 
            onClick={onToggle}
            className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-700/50 flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-all"
        >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="mr-0.5" />}
        </button>
    </motion.div>
);

interface FloatingChatbotProps {
    contextData?: any;
    fullDbData?: any;
    isFetchingDb?: boolean;
    gardenInfo?: any;
    userId?: string;
    partnershipId?: string | null;
}

export const FloatingChatbot: React.FC<FloatingChatbotProps> = ({ contextData, fullDbData, userId, partnershipId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const storageKey = `ulfah_chatbot_${partnershipId}_${userId}`;

    // Load messages from memory
    useEffect(() => {
        if (!partnershipId || !userId) return;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse chatbot memory", e);
            }
        }
    }, [partnershipId, userId, storageKey]);

    // Save messages to memory
    useEffect(() => {
        if (messages.length > 0 && partnershipId && userId) {
            const messagesToSave = messages.slice(-50); // Keep last 50 messages to avoid quota limits
            localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
        }
    }, [messages, partnershipId, userId, storageKey]);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio("https://streamer.radio.co/sf2fa6ce9d/listen");
        }
    }, []);

    const toggleRadio = () => {
        if (!audioRef.current) return;
        if (isRadioPlaying) {
            audioRef.current.pause();
            setIsRadioPlaying(false);
        } else {
            audioRef.current.play();
            setIsRadioPlaying(true);
        }
    };

    // Initial Greeting & Proactive Nudging Logic
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            let initialText = `أهلاً ${contextData?.userName}! 👋 أنا رفيقكم لوفي..`;
            
            const stats = contextData?.stats || {};
            const recentLetter = contextData?.lastLoveLetter;
            
            if (recentLetter) {
                initialText = `أهلاً ${contextData?.userName}! 👋 شفت ${contextData?.partnerName} بعتلك رسالة حب بتطير العقل! 💌 حابب نرد عليها؟`;
            } else if (stats.uncompletedTasks > 0) {
                initialText = `يا هلا ${contextData?.userName}! 👒 لساتني شايف إنه عندكم ${stats.uncompletedTasks} مهام بدها همة.. شو رأيك نخلص وحدة؟ 🥂`;
            } else if (contextData?.daysSinceLastMessage >= 3) {
                initialText = `هلا ${contextData?.userName}.. 👒 صارلكم ${contextData?.daysSinceLastMessage} أيام هاديين.. شو رأيك نكسر الروتين؟`;
            } else {
                initialText = `أهلاً ${contextData?.userName}! 👋 علاقتكم اليوم مثل الورد 🌸. كيف بقدر أخلي يومكم أحلى؟`;
            }

            setMessages([{
                id: 'init',
                text: initialText,
                isBot: true,
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    }, [isOpen, contextData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async (textToSendArg?: string) => {
        const textToSend = (typeof textToSendArg === 'string') ? textToSendArg : inputValue;
        if (!textToSend || !textToSend.trim() || isTyping) return;

        const newMsg = {
            id: Date.now().toString(),
            text: textToSend.trim(),
            isBot: false,
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMsg]);
        setInputValue('');
        setIsTyping(true);

        const detectsRadio = /راديو|موسيقى|شغل|اغنية|playlist/i.test(textToSend);
        const botMsgId = (Date.now() + 1).toString();

        try {
            let receivedFirstChunk = false;
            // Pass the current messages as history (limit to last 10 for performance)
            await getAIResponseStreaming(textToSend, messages.slice(-10), contextData, fullDbData, (updatedText) => {
                if (!receivedFirstChunk) {
                    setIsTyping(false);
                    receivedFirstChunk = true;
                    // Add the bot message to the chat
                    setMessages(prev => [...prev, {
                        id: botMsgId,
                        text: updatedText,
                        isBot: true,
                        isRadio: detectsRadio,
                        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                    }]);
                } else {
                    setMessages(prev => prev.map(m => 
                        m.id === botMsgId ? { ...m, text: updatedText } : m
                    ));
                }
            });
            
            if (detectsRadio && !isRadioPlaying) {
                toggleRadio();
            }
        } catch (error) {
            console.error("Streaming error:", error);
        } finally {
            setIsTyping(false);
        }
    };

    const clearChat = () => {
        setMessages([]);
        if (partnershipId && userId) {
            localStorage.removeItem(storageKey);
        }
        if (isRadioPlaying) toggleRadio();
    };

    return (
        <div className="fixed bottom-24 right-5 z-50 flex items-end justify-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        dir="rtl"
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30, transition: { duration: 0.2 } }}
                        className="absolute bottom-20 right-0 w-[94vw] max-w-[420px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col"
                        style={{ height: '80vh', maxHeight: '720px' }}
                    >
                        {/* Header */}
                        <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shrink-0 z-30 shadow-sm relative">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shadow-inner overflow-hidden border border-rose-100 dark:border-rose-900/50 p-0.5">
                                    <img src="/luffy_normal.png" alt="Lufi" className="w-full h-full object-cover object-top rounded-full" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2 leading-none mb-1">
                                        د. لوفي
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                    </h3>
                                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">مستشار ألفة الذكي</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={clearChat} className="w-9 h-9 rounded-full bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                    <X size={14} className="rotate-45" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="w-9 h-9 rounded-full bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scrollbar-hide bg-zinc-50/50 dark:bg-black/20 relative z-10">
                            
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex w-full ${msg.isBot ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`flex gap-3 max-w-[85%] ${msg.isBot ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                                        {msg.isBot && (
                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white dark:bg-zinc-800 shrink-0 shadow-sm border border-rose-100 dark:border-white/10 p-0.5 z-10">
                                                <img src="/luffy_normal.png" alt="Lufi" className="w-full h-full object-cover object-top rounded-full" />
                                            </div>
                                        )}
                                        <div className={`flex flex-col gap-1 w-full ${msg.isBot ? 'items-end' : 'items-start'}`}>
                                            <div className={`rounded-[1.5rem] px-5 py-3.5 shadow-sm border relative z-10 ${msg.isBot
                                                    ? 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-100 dark:border-white/5 rounded-bl-sm'
                                                    : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white border-rose-600/20 rounded-br-sm shadow-rose-500/20'
                                                }`}>
                                                <p className="text-[14px] font-bold leading-relaxed whitespace-pre-wrap">
                                                    {msg.text.split(/(\*\*.*?\*\*)/).map((part: string, i: number) => 
                                                        part.startsWith('**') && part.endsWith('**') 
                                                        ? <strong key={i} className={`font-black ${msg.isBot ? 'text-rose-600 dark:text-rose-400' : 'text-rose-100'}`}>{part.slice(2, -2)}</strong> 
                                                        : part
                                                    )}
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-black opacity-40 uppercase tracking-widest px-2">
                                                {msg.time}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            
                            {isTyping && (
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex w-full justify-end"
                                >
                                    <div className="flex gap-3 max-w-[85%] flex-row-reverse items-end">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white dark:bg-zinc-800 shrink-0 shadow-sm border border-rose-100 dark:border-white/10 p-0.5 z-10">
                                            <img src="/luffy_thinking.png" alt="Lufi Thinking" className="w-full h-full object-cover object-top rounded-full" />
                                        </div>
                                        <div className="bg-white dark:bg-zinc-800 px-5 py-4 rounded-[1.5rem] rounded-bl-sm shadow-sm border border-zinc-100 dark:border-white/5 flex items-center gap-2 relative z-10">
                                            <div className="flex gap-1.5 flex-row-reverse">
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>

                        {/* Sticky Radio & Quick Start Area */}
                        <div className="p-5 bg-white/90 dark:bg-zinc-900/90 border-t border-zinc-100 dark:border-white/5 space-y-4 shrink-0">
                            <AnimatePresence>
                                {isRadioPlaying && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <RadioWidget isPlaying={isRadioPlaying} onToggle={toggleRadio} />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {messages.length < 10 && (
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    <QuickStartCard icon="📻" label="راديو ألفة" onClick={toggleRadio} />
                                    <QuickStartCard icon="🧪" label="حلل علاقتنا" onClick={() => handleSend("بصفتك دكتور علاقات، حلل علاقتنا اليوم بناءً على المهام والذكريات والمزاج")} />
                                    <QuickStartCard icon="📍" label="وين الشريك؟" onClick={() => handleSend(`أين ${contextData?.partnerName} الآن؟`)} />
                                    <QuickStartCard icon="🔍" label="شخصيتي" onClick={() => handleSend("حلل شخصيتي بناء على بياناتي في ألفة")} />
                                </div>
                            )}

                            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="اكتب لـ لوفي..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    className="flex-1 bg-zinc-100 dark:bg-white/5 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-900 dark:text-white transition-all focus:ring-1 focus:ring-rose-500/30 placeholder:text-zinc-400"
                                    disabled={isTyping}
                                />
                                <motion.button
                                    type="submit"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={!inputValue.trim() || isTyping}
                                    className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center disabled:opacity-20 transition-all shadow-md"
                                >
                                    <Send size={20} className="rtl:rotate-180" />
                                </motion.button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-[72px] h-[72px] rounded-full bg-white dark:bg-zinc-800 shadow-[0_10px_30px_rgba(244,63,94,0.3)] relative z-50 overflow-hidden border-[3px] border-rose-100 dark:border-rose-900/50 flex items-center justify-center group"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} className="text-rose-500">
                            <X size={32} />
                        </motion.div>
                    ) : (
                        <motion.span 
                            key="avatar" 
                            initial={{ scale: 0.5, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="text-[34px] drop-shadow-md"
                        >
                            👒
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};
