import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, UtensilsCrossed, Plus, X, Shuffle, Sparkles, ChevronLeft, ChevronRight, HelpCircle, Play, Eye, Share2, Star, Zap, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface DecisionMakerProps {
    onBack: () => void;
    isDarkMode?: boolean;
    userId: string;
    partnershipId: string | null;
}

const ConfettiPiece = ({ index }: { index: number }) => {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Random direction and distance
    const initialX = 0;
    const initialY = 0;
    const targetX = (Math.random() * 400 - 200); // Shoot out left or right
    const targetY = -(Math.random() * 200 + 100); // Shoot up
    
    return (
        <motion.div
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{ 
                x: [0, targetX, targetX + (Math.random() * 40 - 20)],
                y: [0, targetY, 200], // Shoot up then fall down
                opacity: [1, 1, 0],
                rotate: [0, 360, 720],
                scale: [1, 0.8, 0.5]
            }}
            transition={{ 
                duration: 2.5, 
                ease: "easeOut",
                delay: Math.random() * 0.2 
            }}
            className="absolute top-1/2 left-1/2 w-3 h-3 rounded-sm z-50"
            style={{ backgroundColor: color }}
        />
    );
};

export function DecisionMakerScreen({ onBack, isDarkMode, userId, partnershipId }: DecisionMakerProps) {
    const [options, setOptions] = useState<string[]>(['شاورما', 'برجر', 'سوشي', 'بيتزا', 'مشاوي', 'فطائر', 'كنتاكي']);
    const [newOption, setNewOption] = useState('');
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [rotation, setRotation] = useState(0);
    const [mode, setMode] = useState<'food' | 'movie' | 'custom'>('food');
    const [spectators, setSpectators] = useState(0);
    
    const channelRef = useRef<any>(null);

    // 12 Distinct but Light/Soft Colors
    const palette = isDarkMode 
        ? [
            '#4c1d95', '#1e40af', '#1e3a8a', '#134e4a', '#064e3b', '#3f6212', 
            '#713f12', '#7c2d12', '#831843', '#701a75', '#4c1d95', '#1e1b4b'
          ]
        : [
            '#fdf2f8', '#f5f3ff', '#eff6ff', '#f0fdfa', '#f0fdf4', '#f7fee7', 
            '#fefce8', '#fff7ed', '#fff1f2', '#faf5ff', '#f0f9ff', '#fdf4ff'
          ];

    const textColor = isDarkMode ? 'text-white' : 'text-slate-700';

    // Real-time Sync
    useEffect(() => {
        if (!partnershipId) return;

        const channel = supabase.channel(`decision_${partnershipId}`, {
            config: { broadcast: { self: false } }
        });

        channel
            .on('broadcast', { event: 'spin' }, ({ payload }) => {
                const { targetRotation, finalResult } = payload;
                setRotation(targetRotation);
                setSpinning(true);
                setResult(null);
                
                setTimeout(() => {
                    setSpinning(false);
                    setResult(finalResult);
                }, 4000);
            })
            .on('broadcast', { event: 'sync_options' }, ({ payload }) => {
                setOptions(payload.options);
                setMode(payload.mode);
            })
            .on('broadcast', { event: 'request_sync' }, () => {
                syncOptions(options, mode);
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                setSpectators(Object.keys(state).length);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: userId, online_at: new Date().toISOString() });
                    channel.send({ type: 'broadcast', event: 'request_sync', payload: {} });
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [partnershipId, userId, options, mode]);

    const syncOptions = (newOptions: string[], newMode: string) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'sync_options',
            payload: { options: newOptions, mode: newMode }
        });
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newOption.trim() && !options.includes(newOption.trim()) && options.length < 12) {
            const newOptions = [...options, newOption.trim()];
            setOptions(newOptions);
            setNewOption('');
            syncOptions(newOptions, mode);
        }
    };

    const removeOption = (idx: number) => {
        if (options.length <= 2) return;
        const updated = [...options];
        updated.splice(idx, 1);
        setOptions(updated);
        syncOptions(updated, mode);
    };

    const spinWheel = () => {
        if (options.length < 2 || spinning) return;
        
        setSpinning(true);
        setResult(null);

        const spins = 6 + Math.floor(Math.random() * 4); 
        const randomIndex = Math.floor(Math.random() * options.length);
        const degPerSlice = 360 / options.length;
        const centerOfTarget = (randomIndex * degPerSlice) + (degPerSlice / 2);
        
        const targetRotation = (spins * 360) - centerOfTarget;
        const nextRotation = rotation + targetRotation + (360 - (rotation % 360));

        setRotation(nextRotation);

        channelRef.current?.send({
            type: 'broadcast',
            event: 'spin',
            payload: { 
                targetRotation: nextRotation,
                finalResult: options[randomIndex]
            }
        });

        setTimeout(() => {
            setSpinning(false);
            setResult(options[randomIndex]);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }, 4000);
    };

    const loadPreset = (type: 'food' | 'movie' | 'custom') => {
        let newOptions = options;
        if (type === 'food') newOptions = ['شاورما', 'برجر', 'سوشي', 'بيتزا', 'مشاوي', 'فطائر', 'كنتاكي'];
        if (type === 'movie') newOptions = ['كوميدي', 'أكشن', 'رعب', 'دراما', 'خيال علمي', 'أنيمي'];
        if (type === 'custom') newOptions = ['أنت تدفع', 'أنا بدفع', 'نص نص', 'ع حساب لوفي'];
        
        setMode(type);
        setOptions(newOptions);
        syncOptions(newOptions, type);
    };

    const getWheelGradient = () => {
        const sliceDeg = 360 / options.length;
        let gradient = 'conic-gradient(';
        options.forEach((_, i) => {
            const start = i * sliceDeg;
            const end = (i + 1) * sliceDeg;
            gradient += `${palette[i % palette.length]} ${start}deg ${end}deg${i === options.length - 1 ? '' : ', '}`;
        });
        gradient += ')';
        return gradient;
    };

    return (
        <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#0a0a0c]' : 'bg-slate-50'} overflow-hidden relative font-sans`}>
            
            {/* Header */}
            <div className={`pt-12 pb-6 px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white/20 border-slate-200'} border-b`}>
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-white' : 'bg-slate-200/50 text-slate-700'}`}>
                        <ArrowRight size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black">عجلة القرعة 🎯</h1>
                        {spectators > 1 && (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                                <div className="w-1 h-1 rounded-full bg-emerald-500" /> الشريك يتابع
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={() => loadPreset(mode)} className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-white/5' : 'bg-slate-200/50'}`}>
                    <RotateCcw size={18} className="text-slate-500" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
                
                {/* Presets */}
                <div className="flex gap-2 justify-center mb-10">
                    {[
                        { id: 'food', label: 'مطاعم', icon: UtensilsCrossed },
                        { id: 'movie', label: 'أفلام', icon: Play },
                        { id: 'custom', label: 'مخصص', icon: Sparkles }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => loadPreset(t.id as any)}
                            disabled={spinning}
                            className={`px-6 py-2.5 rounded-2xl text-[13px] font-black transition-all ${mode === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-white/5 text-slate-400'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* --- LARGE ELEGANT WHEEL --- */}
                <div className="relative w-full max-w-[360px] aspect-square mx-auto flex items-center justify-center mb-12">
                    
                    {/* Shadow & Glow */}
                    <div className="absolute inset-0 rounded-full shadow-[0_40px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.5)] -z-10" />
                    <div className="absolute inset-[-10px] rounded-full border border-indigo-500/10 blur-xl -z-20" />

                    {/* Pointer - Modern & Sharp */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-40">
                        <div className="w-8 h-10 bg-indigo-600 rounded-b-xl shadow-xl flex items-end justify-center pb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        </div>
                    </div>

                    {/* Wheel Body */}
                    <motion.div
                        className="relative w-full h-full rounded-full border-[12px] border-white dark:border-[#1a1a1e] overflow-hidden z-10"
                        animate={{ rotate: rotation }}
                        transition={{ duration: 4, ease: [0.2, 0, 0.1, 1] }}
                        style={{ background: getWheelGradient() }}
                    >
                        {/* Elegant Dividers */}
                        {options.map((_, i) => (
                            <div 
                                key={`d-${i}`}
                                className="absolute top-0 left-1/2 h-1/2 w-px bg-white/10 origin-bottom"
                                style={{ transform: `rotate(${i * (360 / options.length)}deg)` }}
                            />
                        ))}

                        {/* Labels - Larger and Centered */}
                        {options.map((opt, i) => {
                            const sliceDeg = 360 / options.length;
                            const centerDeg = i * sliceDeg + sliceDeg / 2;
                            return (
                                <div
                                    key={i}
                                    className="absolute inset-0 flex items-start justify-center pt-14 pointer-events-none"
                                    style={{ transform: `rotate(${centerDeg}deg)` }}
                                >
                                    <span className={`text-[15px] font-black -rotate-90 origin-bottom whitespace-nowrap px-4 py-1 rounded-full ${textColor}`}>
                                        {opt}
                                    </span>
                                </div>
                            );
                        })}
                    </motion.div>

                    {/* Minimalist Center Hub */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={spinWheel}
                            disabled={spinning}
                            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-[6px] ${isDarkMode ? 'bg-[#0f0f12] border-white/5' : 'bg-white border-slate-50'}`}
                        >
                            <div className="flex flex-col items-center">
                                <span className={`text-sm font-black mb-1 ${spinning ? 'text-indigo-500 animate-spin' : 'text-slate-900 dark:text-white'}`}>
                                    {spinning ? '🌀' : 'لف!'}
                                </span>
                                <div className="w-6 h-1 bg-indigo-500 rounded-full" />
                            </div>
                        </motion.button>
                    </div>
                </div>

                {/* --- CLEAN RESULT REVEAL WITH CONFETTI --- */}
                <div className="h-44 flex items-center justify-center relative overflow-visible">
                    <AnimatePresence mode="wait">
                        {result && !spinning ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className={`w-full max-w-sm p-10 rounded-[3rem] text-center border shadow-2xl relative overflow-visible ${isDarkMode ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-white border-slate-100'}`}
                            >
                                {/* Confetti Burst effect */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {[...Array(25)].map((_, i) => (
                                        <ConfettiPiece key={i} index={i} />
                                    ))}
                                </div>

                                <div className="relative z-10">
                                    <h3 className={`text-[12px] font-black uppercase tracking-[0.4em] mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>القرار النهائي</h3>
                                    <h2 className="text-6xl font-black text-indigo-600 tracking-tight leading-tight">
                                        {result}
                                    </h2>
                                </div>
                            </motion.div>
                        ) : spinning && (
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex gap-1.5">
                                    {[0,1,2].map(i => (
                                        <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }} className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                    ))}
                                </div>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تحديد المصير...</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Options List */}
                <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <Plus size={20} />
                        </div>
                        <h3 className="text-lg font-black">أضف خياراتك</h3>
                    </div>

                    <div className="flex flex-wrap gap-2.5 mb-8">
                        {options.map((opt, i) => (
                            <motion.div
                                key={i}
                                layout
                                className={`px-4 py-2 rounded-2xl text-[13px] font-black flex items-center gap-3 border shadow-sm ${isDarkMode ? 'bg-zinc-900 border-white/5 text-zinc-100' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                            >
                                {opt}
                                {!spinning && (
                                    <button onClick={() => removeOption(i)} className="text-rose-500 hover:scale-125 transition-transform"><X size={14} /></button>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    <form onSubmit={handleAdd} className="flex gap-3">
                        <input
                            type="text"
                            value={newOption}
                            onChange={(e) => setNewOption(e.target.value)}
                            disabled={spinning || options.length >= 12}
                            placeholder="شو في ببالك؟..."
                            className={`flex-1 h-14 px-6 rounded-2xl text-sm font-black outline-none border-2 transition-all ${isDarkMode ? 'bg-zinc-900 border-white/5 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-500'}`}
                        />
                        <button type="submit" disabled={!newOption.trim() || spinning} className="w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all">
                            <Plus size={24} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
