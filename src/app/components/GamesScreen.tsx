import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Heart, Sparkles, User, Clock, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';

interface GamesScreenProps {
  onNavigate: (screen: string) => void;
  isDarkMode?: boolean;
}

export function GamesScreen({ onNavigate, isDarkMode }: GamesScreenProps) {
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);

  const games = [
    {
      id: 1,
      type: 'question',
      title: 'لو كنت..',
      question: 'لو كنا في فيلم خيال، أي دور تختارين؟',
      options: ['البطلة الخارقة', 'الملكة الحكيمة', 'المستكشفة الذكية', 'الساحرة الطيبة'],
      color: "bg-[var(--pastel-peach)]",
    },
    {
      id: 2,
      type: 'choice',
      title: 'أيهما تفضل',
      question: 'يوم كامل بدون...',
      options: ['هاتف محمول', 'كلام مع الآخرين'],
      color: "bg-[var(--pastel-green)]",
    },
    {
      id: 3,
      type: 'know-me',
      title: 'من المرجح',
      question: 'من منا ينام أولاً أثناء مشاهدة فيلم؟',
      options: ['أنا طبعاً', 'أنت بالتأكيد', 'نحن الاثنين سوا'],
      correct: 'أنت بالتأكيد',
      color: "bg-[var(--pastel-blue)]",
    },
  ];

  const handleAnswer = (answer: string) => {
    setCurrentAnswer(answer);
  };

  return (
    <div className="flex-1 bg-background flex flex-col relative overflow-hidden">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl z-20">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => selectedGame !== null ? setSelectedGame(null) : onNavigate('home')}
          className="w-10 h-10 flex items-center justify-center bg-card rounded-2xl shadow-sm border border-border"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <h1 className="text-xl font-extrabold tracking-tight">
          {selectedGame !== null ? games[selectedGame].title : 'أسئلة وألعاب'}
        </h1>
        <div className="w-10 h-10 flex items-center justify-center bg-rose-500/10 rounded-2xl text-rose-500 border border-rose-500/10">
          <Sparkles className="w-5 h-5" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-32 space-y-8">
        <AnimatePresence mode="wait">
          {selectedGame === null ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Categories Grid */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">الأقسام</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 1, title: 'لو كنت..', color: 'bg-[var(--pastel-peach)]', icon: '😆', sub: 'تخيّل معي' },
                    { id: 2, title: 'أيهما تفضل', color: 'bg-[var(--pastel-green)]', icon: '🤔', sub: 'اختيارات صعبة' },
                    { id: 3, title: 'من المرجح', color: 'bg-[var(--pastel-blue)]', icon: '💪', sub: 'تحديات' },
                  ].map((cat, i) => (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedGame(i)}
                      className={`${cat.color} aspect-[3/4] rounded-3xl p-3 flex flex-col justify-between items-start border border-black/5 shadow-sm text-right`}
                    >
                      <span className="text-3xl">{cat.icon}</span>
                      <div className="w-full">
                        <h4 className="text-[11px] font-black leading-tight">{cat.title}</h4>
                        <p className="text-[8px] font-bold opacity-40">{cat.sub}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Daily Conversation Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">حوار اليوم</h3>
                <div className="bg-card rounded-[2rem] p-6 shadow-sm border border-border space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20" />
                  <div className="flex items-center justify-between text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1.5 rounded-full w-fit">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>القادم خلال 07:25:55</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-xl font-black text-foreground leading-tight">ما هو الشيء الذي تعلمته عني مؤخراً وفاجأك؟</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full border-2 border-card bg-muted overflow-hidden"><User className="w-5 h-5 mx-auto mt-1 text-muted-foreground" /></div>
                        <div className="w-8 h-8 rounded-full border-2 border-card bg-rose-500/10 overflow-hidden relative z-10"><Heart className="w-5 h-5 mx-auto mt-1 text-primary" fill="currentColor" /></div>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">أجاب شريكك! دورك الآن..</span>
                    </div>
                  </div>

                  <Button className="w-full h-12 rounded-2xl text-xs font-black shadow-lg shadow-primary/10">أجب الآن</Button>
                </div>
              </section>

              {/* More Topics */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">مواضيع أخرى</h3>
                <div className="space-y-3">
                  {[
                    { title: 'البدايات', icon: '🌱', percent: 100, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
                    { title: 'أحلام المستقبل', icon: '✨', percent: 45, color: 'bg-indigo-500', textColor: 'text-indigo-500' },
                    { title: 'ذكريات الطفولة', icon: '🧸', percent: 12, color: 'bg-amber-500', textColor: 'text-amber-500' },
                  ].map((topic, i) => (
                    <div key={i} className="bg-card rounded-2xl p-4 flex items-center justify-between shadow-sm border border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{topic.icon}</span>
                        <div className="text-right">
                          <h4 className="text-sm font-black">{topic.title}</h4>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${topic.color} rounded-full`} style={{ width: `${topic.percent}%` }} />
                            </div>
                            <span className={`text-[9px] font-black ${topic.textColor}`}>{topic.percent}% مكتمل</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-[2.5rem] p-8 shadow-sm border border-border relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/10" />
                <div className="text-center space-y-4 mb-8 mt-2">
                  <div className={`w-20 h-20 rounded-3xl ${games[selectedGame].color} flex items-center justify-center text-white mx-auto shadow-xl group-hover:rotate-6 transition-transform duration-500`}>
                    <Heart className="w-10 h-10 fill-white" />
                  </div>
                  <h2 className="text-2xl font-black text-foreground leading-tight px-2">{games[selectedGame].question}</h2>
                </div>

                <div className="grid gap-3">
                  {games[selectedGame].options.map((option, idx) => (
                    <motion.button
                      key={option}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleAnswer(option)}
                      className={`w-full p-5 rounded-2xl border transition-all font-black text-sm text-right group ${currentAnswer === option
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-muted bg-muted/20 text-muted-foreground'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        {currentAnswer === option && <CheckCircle className="w-5 h-5" />}
                        <span>{option}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence>
                  {currentAnswer && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 space-y-4"
                    >
                      <div className="bg-emerald-500/10 rounded-2xl p-5 text-center border border-emerald-500/20">
                        <p className="text-sm font-black text-emerald-500">
                          {games[selectedGame].type === 'know-me' && games[selectedGame].correct === currentAnswer
                            ? 'صحيح! تعرفني جيداً! 💖'
                            : games[selectedGame].type === 'know-me'
                              ? 'ليس تماماً، لكن شكرًا للمحاولة! ✨'
                              : 'اختيار رائع! تم مشاركة إجابتك. ✨'}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedGame(null);
                          setCurrentAnswer(null);
                        }}
                        className="w-full h-14 bg-foreground text-white rounded-2xl font-black text-md shadow-lg"
                      >
                        العودة للألعاب
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
