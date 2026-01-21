import { Heart, Calendar, MessageCircle, Wallet, Gamepad2, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
    currentScreen: string;
    onNavigate: (screen: string) => void;
}

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
    const navItems = [
        { id: 'home', label: 'ألفة', icon: Home, moodClass: 'text-[#ec4899]', glowClass: 'bg-[#ec4899]' },
        { id: 'calendar', label: 'الذكرى', icon: Calendar, moodClass: 'text-rose-500', glowClass: 'bg-rose-500' },
        { id: 'finance', label: 'المالية', icon: Wallet, moodClass: 'text-emerald-500', glowClass: 'bg-emerald-500' },
        { id: 'games', label: 'ألعابنا', icon: Gamepad2, moodClass: 'text-purple-500', glowClass: 'bg-purple-500' },
        { id: 'dialogues', label: 'الميثاق', icon: MessageCircle, moodClass: 'text-blue-500', glowClass: 'bg-blue-500' },
    ];

    return (
        <div className="w-full">
            <nav className="w-full h-[84px] bg-background/80 backdrop-blur-3xl border-t border-border/50 flex items-center justify-around px-2 pb-safe shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
                {navItems.map((item) => {
                    const isActive = currentScreen === item.id;
                    const Icon = item.icon;

                    return (
                        <motion.button
                            key={item.id}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center gap-2 w-[72px] h-full transition-all duration-500 relative ${isActive ? item.moodClass : 'text-muted-foreground/40 hover:text-foreground/60'
                                }`}
                        >
                            <div className="relative z-10 flex flex-col items-center">
                                <Icon
                                    className={`w-6 h-6 transition-all duration-500 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_currentColor]' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-pill"
                                        className={`absolute -top-3.5 w-1.5 h-1.5 rounded-full shadow-[0_0_15px_currentColor] ${item.glowClass}`}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    />
                                )}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-30'
                                }`}>
                                {item.label}
                            </span>
                        </motion.button>
                    );
                })}
            </nav>
        </div>
    );
}
