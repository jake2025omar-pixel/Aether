import React from 'react';
import { Home, MessageSquare, Info, Heart } from 'lucide-react';

export type NavDestination = 'home' | 'chat' | 'about' | 'support';

export interface NavigationProps {
  currentView: NavDestination;
  onSelectView: (view: NavDestination) => void;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  className = '',
}) => {
  const items = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'about' as const, label: 'About', icon: Info },
    { id: 'support' as const, label: 'Support', icon: Heart },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      className={`select-none pointer-events-auto ${className}`}
    >
      <div className="glass-nav-pill rounded-full p-1 sm:p-1.5 flex items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-medium transition-all duration-200 cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-purple-600/30 text-white border border-purple-400/40 shadow-[0_0_16px_-2px_rgba(168,85,247,0.35)]'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
              }`}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
