import React from 'react';
import {
  Plus,
  Home,
  MessageSquare,
  Heart,
  Info,
  Settings,
  PanelLeftClose,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { AuthControl } from './AuthControl';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeView: 'chat' | 'hero';
  onSelectView: (view: 'chat' | 'hero') => void;
  onOpenSupport: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  chatHistory: { id: string; title: string }[];
  currentChatId: string;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  activeView,
  onSelectView,
  onOpenSupport,
  onOpenAbout,
  onOpenSettings,
  onNewChat,
  chatHistory,
  currentChatId,
  onSelectChat,
  onDeleteChat,
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container - Clean White #FFFFFF */}
      <aside
        className={`fixed md:static inset-y-0 right-0 md:right-auto md:left-0 z-40 w-[260px] bg-[#FFFFFF] border-l md:border-l-0 md:border-r border-[#EFECE6] flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-lg md:shadow-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:-translate-x-full md:hidden'
        }`}
        dir="rtl"
      >
        {/* Top Header & New Chat Button */}
        <div className="p-3.5">
          <div className="flex items-center justify-between px-2 py-1 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                A
              </div>
              <span className="font-bold text-slate-900 text-base tracking-tight">
                AetherAI
              </span>
            </div>

            {/* Close Sidebar button */}
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="إغلاق الشريط الجانبي"
            >
              <PanelLeftClose className="w-5 h-5 rotate-180 md:rotate-0" />
            </button>
          </div>

          {/* New Chat Button - Purple #7c3aed with icon + */}
          <button
            onClick={onNewChat}
            className="w-full py-2.5 px-3.5 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold flex items-center justify-between shadow-md shadow-[#7C3AED]/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>محادثة جديدة</span>
            </span>
            <span className="text-xs text-purple-200 font-mono">⌘N</span>
          </button>

          {/* Hamburger Menu Contents */}
          <div className="mt-4 space-y-1">
            <button
              onClick={() => onSelectView('hero')}
              className={`w-full px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                activeView === 'hero'
                  ? 'bg-purple-50 text-[#7C3AED] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Home className="w-4 h-4 text-purple-500" />
              <span>الرئيسية (بينتو جريد)</span>
            </button>

            <button
              onClick={() => onSelectView('chat')}
              className={`w-full px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                activeView === 'chat'
                  ? 'bg-purple-50 text-[#7C3AED] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-purple-500" />
              <span>الشات</span>
            </button>

            <button
              onClick={onOpenSupport}
              className="w-full px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Heart className="w-4 h-4 text-pink-500 fill-pink-100" />
              <span>الدعم</span>
            </button>

            <button
              onClick={onOpenAbout}
              className="w-full px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4 text-indigo-500" />
              <span>حول</span>
            </button>
          </div>
        </div>

        {/* Middle: Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 border-t border-[#F0ECE1]">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            المحادثات الأخيرة
          </div>

          {chatHistory.length === 0 ? (
            <div className="px-3 py-5 text-xs text-slate-400 text-center">
              لا توجد محادثات سابقة
            </div>
          ) : (
            chatHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectChat(item.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                  currentChatId === item.id && activeView === 'chat'
                    ? 'bg-purple-50/80 text-purple-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-purple-600" />
                  <span className="truncate">{item.title}</span>
                </div>
                <button
                  onClick={(e) => onDeleteChat(item.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 rounded transition-opacity"
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bottom: Authentication control + settings */}
        <div className="p-3 border-t border-[#F0ECE1] bg-[#FAFAF8] space-y-2">
          <AuthControl variant="sidebar" />
          <div className="flex items-center justify-between px-2 pt-1 text-slate-500">
            <span className="text-[11px] font-semibold text-slate-400">خيارات المنصة</span>
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              title="الإعدادات"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
