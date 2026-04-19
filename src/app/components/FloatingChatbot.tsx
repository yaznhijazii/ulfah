import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, AlertCircle, Bot } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Mock AI responses as fallback
const getMockResponse = (text: string): string => {
    return 'مرحباً! أنا لوفي 🤖. لم يتم تفعيل مفتاح الذكاء الاصطناعي الخاص بي بعد، لكنني هنا لأجلكم!';
};

const getAIResponse = async (text: string, contextData: any, fullDbData: any): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("VITE_GEMINI_API_KEY is missing. Using fallback mock responses.");
        return getMockResponse(text);
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `أنت مستشار علاقات وذكاء اصطناعي لطيف وذكي جداً اسمك "لوفي" (Luffy). 
صُممت خصيصاً لتحليل العلاقة العاطفية بين شريكين وقراءة كل بياناتهم لتكون مرشداً لهما.

هنا السياق العام للعلاقة الآن:
${JSON.stringify(contextData)}

وهنا نظرة شاملة على قاعدة البيانات الخاصة بهم (أحداث، مشاعر، رسائل حب ماضية):
${JSON.stringify(fullDbData)}

ملاحظات هامة جداً للاستخدام في إجاباتك عند السؤال:
- استخدم اسم المستخدم (${contextData.userName}) لتناديه باسمه الأول، واذكر اسم شريكه (${contextData.partnerName}) بدلاً من قول (شريكك) لتكون المحادثة حميمية جداً.
- للرد على (أين شريكي/حبيبي الآن؟)، استخدم بيانات الموقع في السياق: مسافة البعد (distance) وهل هو متصل (isOnline) وآخر ظهور (lastSeenFormatted).
- للرد على (متى آخر رسالة؟)، انظر في (latestNote) ضمن السياق الافتراضي واذكر فحواها وتاريخها إن وجدتموها.
- لتقييم العلاقة (تقييم/حلل علاقتنا)، اجمع عدد المهام المنجزة ورسائل الحب وحالة المزاج الحالية وأعطِ تقييماً من 10 بحنية، واقترح نشاطاً لحل أي نقص.

مهمتك:
- حلل هذه البيانات جيداً لتفهم مشاعرهم، ما ينقصهم اليوم، وما يحتاجون لسماعه.
- أجب بحنية ولغة عربية جميلة وعفوية (وقصيرة قدر الإمكان إلا إذا استدعى الأمر).
- استخدم بياناتهم الحقيقية في إجابتك لتثبت لهم أنك تفهم علاقتهم.
- استخدم الإيموجيز المناسبة 💜✨.

رسالة المستخدم لك: "${text}"`
                    }]
                }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error details:", data.error);
            return `عذراً، ظهر خطأ من الخادم: ${data.error.message}`;
        }

        const candidate = data.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            return "عذراً، تم حجب الرد بسبب قيود الأمان (Safety Filters). 💜";
        }

        return candidate?.content?.parts?.[0]?.text || "عذراً، عقلي مشتت قليلاً، لم أتلقَّ رداً صحيحاً من الخادم! 💜";
    } catch (e: any) {
        console.error("Gemini AI Error:", e);
        return `واجهت مشكلة في الاتصال بالإنترنت أو الخادم: ${e.message}`;
    }
};

interface FloatingChatbotProps {
    gardenInfo: { label: string; icon: string; level: number };
    userId: string;
    partnershipId: string | null;
    contextData?: any;
}

export const FloatingChatbot: React.FC<FloatingChatbotProps> = ({ gardenInfo, userId, partnershipId, contextData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [fullDbData, setFullDbData] = useState<any>(null);
    const [isFetchingDb, setIsFetchingDb] = useState(false);

    const [messages, setMessages] = useState<{ id: string; text: string; isBot: boolean; time: string }[]>([
        {
            id: 'init-msg',
            text: `أهلاً! أنا "لوفي" 🤖 الذكاء الاصطناعي الخاص بعلاقتكم. قرأت كل تفاصيلكم وتاريخكم معاً! شو ناقصنا اليوم لنخلي العلاقة أحلى؟`,
            isBot: true,
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            // Fetch comprehensive DB data once when opened
            if (!fullDbData && partnershipId && !isFetchingDb) {
                fetchAllData();
            }
        }
    }, [messages, isOpen]);

    const fetchAllData = async () => {
        setIsFetchingDb(true);
        try {
            // Fetch a sample of deep relationship data to feed to Gemini
            const [notesRes, moodsRes, eventsRes] = await Promise.all([
                supabase.from('love_notes').select('content, created_at, font_style').eq('partnership_id', partnershipId).order('created_at', { ascending: false }).limit(5),
                supabase.from('mood_logs').select('mood, created_at').eq('partnership_id', partnershipId).order('created_at', { ascending: false }).limit(10),
                supabase.from('timeline_events').select('title, description, event_date').eq('partnership_id', partnershipId).order('event_date', { ascending: false }).limit(5)
            ]);

            setFullDbData({
                recentNotes: notesRes.data || [],
                recentMoods: moodsRes.data || [],
                timeline: eventsRes.data || []
            });
        } catch (e) {
            console.error("Error fetching context for AI", e);
        } finally {
            setIsFetchingDb(false);
        }
    };

    const handleSend = (textOverride?: string) => {
        const textToSend = textOverride || inputValue;
        if (!textToSend.trim()) return;

        const newMsg = {
            id: Date.now().toString(),
            text: textToSend,
            isBot: false,
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMsg]);
        setInputValue('');
        setIsTyping(true);

        // Call AI API
        setTimeout(async () => {
            const aiReplyText = await getAIResponse(newMsg.text, contextData, fullDbData);
            const aiReply = {
                id: (Date.now() + 1).toString(),
                text: aiReplyText,
                isBot: true,
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiReply]);
            setIsTyping(false);
        }, 500);
    };

    return (
        <div className="fixed bottom-24 right-5 z-50 flex items-end justify-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } }}
                        className="absolute bottom-20 right-0 w-[94vw] max-w-[380px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col glass"
                        style={{ height: '75vh', maxHeight: '650px' }}
                    >
                        {/* Chatbot Header */}
                        <div className="p-5 bg-gradient-to-br from-rose-500/10 to-orange-500/5 border-b border-rose-500/10 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center shadow-lg shadow-rose-500/30 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-black/10"></div>
                                    <span className="text-2xl drop-shadow-md z-10 relative group-hover:scale-110 transition-transform">👒</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase">
                                        لوفي (Luffy)
                                        <Sparkles size={12} className="text-rose-500" />
                                    </h4>
                                    <p className="text-[10px] font-bold text-rose-600/70 dark:text-rose-400/60 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        {isFetchingDb ? "يقرأ ذكرياتكم..." : "متصل، ويحلل العلاقة بعمق"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-zinc-500 dark:text-white/60 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex gap-2 ${msg.isBot ? 'justify-start items-end' : 'justify-end'}`}
                                >
                                    {msg.isBot && <img src="/luffy_normal.png" className="w-11 h-11 rounded-full object-contain bg-rose-500/5 shrink-0 border border-rose-500/10 shadow-sm" alt="Luffy" />}
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.isBot
                                            ? 'bg-zinc-100 dark:bg-zinc-800 rounded-tr-sm text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/5'
                                            : 'bg-gradient-to-r from-rose-500 to-orange-600 rounded-tl-sm text-white shadow-md shadow-rose-500/20'
                                        }`}>
                                        <p className="text-xs font-bold leading-relaxed">{msg.text}</p>
                                        <span className={`block text-[8px] mt-1.5 font-bold ${msg.isBot ? 'text-zinc-400' : 'text-rose-100/70'}`}>
                                            {msg.time}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-2">
                                    <img src="/luffy_thinking.png" className="w-11 h-11 rounded-full object-contain bg-rose-500/5 shrink-0 border border-rose-500/10 animate-pulse shadow-sm" alt="Luffy Thinking" />
                                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-3 border border-zinc-200 dark:border-white/5 flex gap-1 h-fit mb-1">
                                        <motion.div className="w-1.5 h-1.5 bg-rose-500 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                                        <motion.div className="w-1.5 h-1.5 bg-rose-500 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                                        <motion.div className="w-1.5 h-1.5 bg-rose-500 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Informational Prompt */}
                        <div className="px-4 pb-1">
                            <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 rounded-xl p-2 flex items-start gap-2">
                                <AlertCircle size={14} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight">
                                    لوفي (Luffy) قادر على قراءة كل تاريخكم في البرنامج ليوفّر دراسة ذكية عن احتياجات العلاقة الحالية.
                                </p>
                            </div>
                        </div>

                        {/* Quick Prompts */}
                        <div className="px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-hide w-full mask-linear-right">
                            {[
                                "حلل علاقتنا 📊",
                                "وين شريكي هسا؟ 📍",
                                "متى آخر رسالة عالبريد؟ 💌",
                                "نصيحة سريعة 💡"
                            ].map((prompt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (isTyping) return;
                                        handleSend(prompt);
                                    }}
                                    className="whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:text-rose-600 transition-colors shrink-0 shadow-sm"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-white/5 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="اكتب مشكلة أو سؤال..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                            />
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isTyping}
                                className="w-10 h-10 shrink-0 rounded-xl bg-rose-600 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-zinc-300 transition-colors shadow-md shadow-rose-500/20"
                            >
                                <Send size={16} className="rtl:rotate-180" />
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-16 h-16 rounded-[2.2rem] bg-gradient-to-br from-rose-500 to-orange-600 text-white flex items-center justify-center shadow-2xl shadow-rose-500/40 relative group"
            >
                <motion.div
                    className="absolute -inset-1 rounded-[2.4rem] bg-rose-500/30 blur-md"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                />
                <div className="relative z-10 flex text-3xl drop-shadow-lg group-hover:rotate-[15deg] transition-transform duration-300">
                    {isOpen ? <X size={28} className="text-white" /> : <span>👒</span>}
                </div>
            </motion.button>
        </div>
    );
};
