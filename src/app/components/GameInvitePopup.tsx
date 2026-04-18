import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play } from 'lucide-react';
import { Button } from './ui/button';

interface GameInvitePopupProps {
    invite: {
        id: string;
        title: string;
        body: string;
        metadata: {
            room_code: string;
            game_type: string;
        };
    };
    onAccept: (invite: any) => void;
    onClose: () => void;
}

export function GameInvitePopup({ invite, onAccept, onClose }: GameInvitePopupProps) {
    return (
        <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="w-full max-w-[400px] pointer-events-auto"
        >
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-5 shadow-2xl border border-rose-500/20 flex items-center gap-4 relative overflow-hidden group">
                {/* Glow Effect */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/10 blur-2xl rounded-full" />
                
                <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20 rotate-3">
                    <Trophy className="w-6 h-6" />
                </div>
                
                <div className="flex-1 text-right">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">دعوة جديدة ✨</p>
                    <h4 className="text-sm font-black text-rose-950 dark:text-white mb-0.5">{invite.title}</h4>
                    <p className="text-[10px] font-bold text-rose-900/40 dark:text-rose-100/40 line-clamp-1">{invite.body}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <Button 
                        onClick={() => onAccept(invite)}
                        size="sm"
                        className="bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] h-8 rounded-xl px-4 flex items-center gap-1"
                    >
                        انضمام <Play size={10} fill="white" />
                    </Button>
                    <button 
                        onClick={onClose}
                        className="text-[10px] font-black text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        تجاهل
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
