import React from 'react';
import { Award, RotateCw, ArrowRight, Timer, Zap, Star, Gem } from 'lucide-react';
import { LevelStats } from '../types';

interface WinModalProps {
  stats: LevelStats | null;
  history: LevelStats[];
  onNextLevel: () => void;
  onReset: () => void;
}

const formatDuration = (ms: number): string => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; className?: string }> = ({ icon, label, value, className }) => (
    <div className={`bg-black/20 p-4 rounded-lg flex flex-col items-center justify-center text-center ${className}`}>
        <div className="flex items-center gap-2 text-gray-300">
            {icon}
            <span className="text-sm font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white mt-1">{typeof value === 'number' ? value.toLocaleString('ko-KR') : value}</p>
    </div>
);


const WinModal: React.FC<WinModalProps> = ({ stats, history, onNextLevel, onReset }) => {
    
    const overallStats = React.useMemo(() => {
        if (history.length === 0) {
            return {
                levelsCleared: 0,
                avgMoves: 0,
                totalScore: 0,
            };
        }
        
        const totalMoves = history.reduce((sum, s) => sum + s.moves, 0);
        const totalScore = history.reduce((sum, s) => sum + (s.score || 0), 0);
        
        return {
            levelsCleared: history.length,
            avgMoves: (totalMoves / history.length).toFixed(1),
            totalScore: totalScore,
        };
    }, [history]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-brand-bg to-brand-tube/80 rounded-2xl shadow-2xl p-6 md:p-8 m-4 max-w-md w-full text-center border-2 border-fuchsia-400/50 transform transition-all scale-100 animate-fade-in">
        <div className="flex justify-center items-center gap-3 mb-3">
            <Award className="text-yellow-400" size={48} strokeWidth={1.5}/>
            <h2 className="text-3xl md:text-4xl font-bold text-fuchsia-300">레벨 {stats?.level} 클리어!</h2>
        </div>
        
        <div className="my-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">이번 라운드 기록</h3>
            <div className="grid grid-cols-3 gap-3">
                 <StatCard icon={<Timer size={20}/>} label="시간" value={formatDuration(stats?.duration ?? 0)} />
                 <StatCard icon={<Zap size={20}/>} label="이동" value={stats?.moves ?? 0} />
                 <StatCard icon={<Star size={20}/>} label="점수" value={stats?.score ?? 0} />
            </div>
        </div>

        <div className="my-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">전체 기록</h3>
            <div className="grid grid-cols-3 gap-3">
                 <StatCard icon={<Award size={18}/>} label="클리어" value={overallStats.levelsCleared} className="text-sm" />
                 <StatCard icon={<Gem size={18}/>} label="총점" value={overallStats.totalScore} className="text-sm" />
                 <StatCard icon={<Zap size={18}/>} label="평균 이동" value={overallStats.avgMoves} className="text-sm" />
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600/50 hover:bg-gray-500/50 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            <RotateCw size={20} />
            다시하기
          </button>
          <button
            onClick={onNextLevel}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg shadow-fuchsia-500/30"
          >
            다음 레벨
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default WinModal;