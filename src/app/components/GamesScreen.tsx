import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';

interface GamesScreenProps {
  onNavigate: (screen: string) => void;
}

export function GamesScreen({ onNavigate }: GamesScreenProps) {
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);

  const games = [
    {
      id: 1,
      type: 'question',
      title: 'سؤال اليوم',
      question: 'ما هي وجهة أحلامك للموعد؟',
      options: ['غروب على الشاطئ', 'كابينة بالجبال', 'سطح بالمدينة', 'ليلة هادئة بالبيت'],
    },
    {
      id: 2,
      type: 'know-me',
      title: 'كم تعرفني؟',
      question: 'ما هو موسمي المفضل؟',
      options: ['الربيع', 'الصيف', 'الخريف', 'الشتاء'],
      correct: 'الخريف',
    },
    {
      id: 3,
      type: 'choice',
      title: 'ماذا تفضل؟',
      question: 'أيهما تفضل...',
      options: ['رحلة مغامرة', 'يوم استرخاء بالسبا'],
    },
  ];

  const handleAnswer = (answer: string) => {
    setCurrentAnswer(answer);
  };

  if (selectedGame !== null) {
    const game = games[selectedGame];
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="w-9" />
              <h1 className="text-lg text-gray-800">{game.title}</h1>
              <button
                onClick={() => {
                  setSelectedGame(null);
                  setCurrentAnswer(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="bg-white rounded-3xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-200 to-rose-200 mb-4">
                <Heart className="w-8 h-8 text-rose-600" fill="currentColor" />
              </div>
              <h2 className="text-2xl text-gray-800 mb-2">{game.question}</h2>
            </div>

            <div className="space-y-3 mb-6">
              {game.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all text-right ${
                    currentAnswer === option
                      ? 'border-rose-400 bg-gradient-to-br from-pink-50 to-rose-50'
                      : 'border-gray-200 hover:border-rose-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-gray-700">{option}</span>
                </button>
              ))}
            </div>

            {currentAnswer && (
              <div className="text-center">
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 mb-4">
                  <p className="text-gray-700">
                    {game.type === 'know-me' && game.correct === currentAnswer
                      ? 'صحيح! تعرفني جيدًا!'
                      : game.type === 'know-me'
                      ? 'ليس تمامًا، لكن شكرًا للمحاولة!'
                      : 'اختيار رائع! تم مشاركة إجابتك.'}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setSelectedGame(null);
                    setCurrentAnswer(null);
                  }}
                  className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl"
                >
                  العودة للألعاب
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-24">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="w-9" />
            <h1 className="text-lg text-gray-800">الألعاب</h1>
            <button
              onClick={() => onNavigate('home')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="space-y-4">
          {games.map((game, index) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(index)}
              className="w-full bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition-shadow text-right"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg text-gray-800 mb-2">{game.title}</h3>
                  <p className="text-gray-600">{game.question}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 bg-gradient-to-br from-rose-50 to-pink-50 rounded-3xl p-6 text-center">
          <p className="text-gray-700">
            العبوا معًا واكتشفوا المزيد عن بعضكم
          </p>
        </div>
      </div>
    </div>
  );
}
