import { Heart, ImageIcon, Calendar, Target, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
    currentScreen: string;
    onNavigate: (screen: string) => void;
}

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {

    const navItems = [
        { id: 'home', label: 'الرئيسية', icon: Heart },
        { id: 'calendar', label: 'الذكرى والوقت', icon: Calendar },
        { id: 'dialogues', label: 'دستور العلاقة', icon: MessageCircle },
    ];


    return (
        <nav className="w-full bg-background/95 backdrop-blur-xl border-t border-border z-[100] pb-safe">
            <div className="max-w-[480px] mx-auto h-[60px] flex items-center justify-around">
                {navItems.map((item) => {
                    const isActive = currentScreen === item.id;
                    const Icon = item.icon;

                    return (
                        <motion.button
                            key={item.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center gap-0.5 w-[72px] h-full transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'
                                }`}
                        >
                            <div className="relative">
                                <Icon
                                    className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    fill={isActive && (item.id === 'home' || item.id === 'memories') ? 'currentColor' : 'none'}
                                />
                            </div>
                            <span className={`text-[9px] font-black tracking-tight ${isActive ? 'text-primary' : 'opacity-70'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <motion.div
                                    layoutId="active-nav-dot"
                                    className="w-1 h-1 bg-primary rounded-full absolute bottom-1"
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </nav>
    );
}
