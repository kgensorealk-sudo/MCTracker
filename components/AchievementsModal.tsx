import React, { useState } from 'react';
import { Manuscript } from '../types';
import { ACHIEVEMENTS, DAILY_QUESTS, calculateXP, calculateLevel } from '../services/gamification';
import { Trophy, X, Zap, Flame, Star, CheckCheck, Search, Target, Lock, Moon, Scroll, Medal, User, Sparkles } from 'lucide-react';

interface GamificationHubProps {
  manuscripts: Manuscript[];
  target: number;
  userName: string;
  onClose: () => void;
}

const IconMap: Record<string, any> = {
  Zap, Flame, Star, Trophy, CheckCheck, Search, Target, Moon
};

const GamificationHub: React.FC<GamificationHubProps> = ({ manuscripts, target, userName, onClose }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'achievements'>('profile');
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const totalXP = calculateXP(manuscripts, target);
  const userLevel = calculateLevel(totalXP);
  const unlockedCount = ACHIEVEMENTS.filter(a => a.condition(manuscripts, target)).length;
  const totalAchievements = ACHIEVEMENTS.length;
  
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'from-indigo-400 to-purple-500 text-white border-purple-300';
      case 'GOLD': return 'from-amber-300 to-yellow-500 text-yellow-950 border-yellow-400';
      case 'SILVER': return 'from-slate-200 to-slate-400 text-slate-900 border-slate-300';
      case 'BRONZE': return 'from-orange-200 to-orange-400 text-orange-950 border-orange-300';
      default: return 'bg-white border-slate-200';
    }
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row h-full md:h-[600px] ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-900 text-white flex flex-col p-6 shrink-0">
           <div className="mb-8 flex items-center gap-3">
             <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30">
                <Trophy className="w-6 h-6 text-white" />
             </div>
             <div>
               <h2 className="font-bold text-lg leading-none">Career</h2>
               <span className="text-xs text-indigo-300 tracking-wider font-medium">PROGRESSION</span>
             </div>
           </div>

           <nav className="space-y-2 flex-1">
             <button 
               onClick={() => setActiveTab('profile')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                 activeTab === 'profile' 
                   ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md font-medium' 
                   : 'hover:bg-white/10 text-slate-400 hover:text-white'
               }`}
             >
               <User className="w-5 h-5" />
               Profile & Quests
             </button>
             <button 
               onClick={() => setActiveTab('achievements')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                 activeTab === 'achievements' 
                   ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md font-medium' 
                   : 'hover:bg-white/10 text-slate-400 hover:text-white'
               }`}
             >
               <Medal className="w-5 h-5" />
               Achievements
             </button>
           </nav>

           <div className="mt-auto pt-6 border-t border-slate-700">
             <button onClick={handleClose} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
                <X className="w-4 h-4" /> Close Panel
             </button>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 relative">
          
          <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-inner">
                  {userLevel.level}
                </div>
                <div>
                   <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{userName}</h1>
                   <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-indigo-600">{userLevel.title}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">{totalXP.toLocaleString()} XP</span>
                   </div>
                </div>
             </div>
             <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Badges</p>
                <p className="text-2xl font-bold text-slate-800">{unlockedCount} <span className="text-slate-400 text-lg font-normal">/ {totalAchievements}</span></p>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {activeTab === 'profile' && (
              <div className="space-y-8 animate-fade-in">
                 <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Sparkles className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-slate-500">Progress to Level {userLevel.level + 1}</span>
                        <span className="text-sm font-bold text-indigo-600">{userLevel.currentXP} / {userLevel.nextLevelXP} XP</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                         <div 
                           className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-1000"
                           style={{ width: `${userLevel.progressPercent}%` }}
                         ></div>
                      </div>
                    </div>
                 </div>

                 <div>
                   <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <Scroll className="w-5 h-5 text-indigo-500" /> Daily Quests
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {DAILY_QUESTS.map(quest => {
                        const isDone = quest.isCompleted(manuscripts);
                        const progress = quest.progress(manuscripts);
                        const percent = Math.min(100, (progress / quest.target) * 100);

                        return (
                          <div key={quest.id} className={`p-4 rounded-xl border-2 transition-all ${
                            isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                          }`}>
                             <div className="flex justify-between items-start mb-2">
                               <h4 className={`font-bold ${isDone ? 'text-emerald-700' : 'text-slate-700'}`}>{quest.title}</h4>
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                 isDone ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-100 text-amber-700'
                               }`}>
                                 {quest.rewardXP} XP
                               </span>
                             </div>
                             <p className="text-xs text-slate-500 mb-4 h-8">{quest.description}</p>
                             
                             <div className="space-y-1">
                               <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                                 <span>{progress} / {quest.target}</span>
                                 <span>{isDone ? 'COMPLETED' : `${Math.round(percent)}%`}</span>
                               </div>
                               <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                               </div>
                             </div>
                          </div>
                        )
                      })}
                   </div>
                 </div>

              </div>
            )}

            {activeTab === 'achievements' && (
               <div className="animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ACHIEVEMENTS.map(achievement => {
                      const isUnlocked = achievement.condition(manuscripts, target);
                      const progress = achievement.progress(manuscripts, target);
                      const currentValue = achievement.currentProgressValue(manuscripts, target);
                      const Icon = IconMap[achievement.icon] || Star;

                      return (
                        <div 
                          key={achievement.id}
                          className={`relative p-5 rounded-xl border transition-all duration-300 group ${
                            isUnlocked 
                              ? `bg-white border-slate-200 shadow-sm hover:shadow-md` 
                              : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br ${
                               isUnlocked ? getTierColor(achievement.tier) : 'from-slate-200 to-slate-300 text-slate-400'
                            }`}>
                              {isUnlocked ? <Icon className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <h3 className={`font-bold text-base ${isUnlocked ? 'text-slate-800' : 'text-slate-500'}`}>
                                  {achievement.title}
                                </h3>
                                {isUnlocked && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        +{achievement.xpReward} XP
                                    </span>
                                )}
                              </div>
                              
                              <p className="text-sm mt-1 text-slate-500 leading-snug">
                                {achievement.description}
                              </p>

                              <div className="mt-3">
                                <div className="flex justify-between text-xs font-semibold mb-1.5">
                                  <span className="text-slate-400">Progress</span>
                                  <span className={isUnlocked ? 'text-indigo-600' : 'text-slate-500'}>
                                    {currentValue} / {achievement.maxProgressValue === 1 && !isUnlocked ? 1 : achievement.maxProgressValue}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${
                                      isUnlocked ? 'bg-indigo-500' : 'bg-slate-300'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamificationHub;