import React from 'react';
import {
  Menu,
  Sparkles,
  ArrowLeft,
  Calendar,
  Wallet,
  MessageSquare,
  Gift,
  Bell,
  CheckCircle2,
  KeyRound,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Star,
  Type,
  ImageIcon,
} from 'lucide-react';
import { GlassLoop3D } from './GlassLoop3D';

interface HeroViewProps {
  onToggleSidebar: () => void;
  onStartChat: () => void;
}

export const HeroView: React.FC<HeroViewProps> = ({ onToggleSidebar, onStartChat }) => {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FFFCF5] text-slate-800 overflow-y-auto relative selection:bg-purple-200">
      {/* Top Bar Minimal with Hamburger button (Light Mode) */}
      <header className="sticky top-0 z-30 h-16 bg-[#FFFCF5]/90 backdrop-blur-xl border-b border-[#F0ECE1] px-4 sm:px-8 flex items-center justify-between">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-700 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
          title="قائمة التنقل"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white text-xs font-bold shadow-md shadow-[#7C3AED]/20">
            A
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-900">
            AetherAI
          </span>
        </div>

        <button
          onClick={onStartChat}
          className="px-4 py-2 rounded-full text-xs font-bold bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <span>ابدأ الشات</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex flex-col items-center">
        {/* Hero Title & Top Section */}
        <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-14 relative flex flex-col items-center">
          {/* Required Small Badge: "المفتاح هو النموذج - API Key is the key to unlock the model" */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-purple-200/80 text-purple-950 text-xs font-semibold mb-6 shadow-sm backdrop-blur-md">
            <KeyRound className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span className="font-bold">المفتاح هو النموذج - API Key is the key to unlock the model</span>
            <span className="text-[10px] text-purple-600 bg-purple-100/80 px-2 py-0.5 rounded-full">Gemini Flash</span>
          </div>

          <div className="relative flex flex-col items-center">
            {/* Floating 3D Infinity Loop accent */}
            <div className="hidden lg:block absolute -top-12 -left-16 z-10 animate-soft-float pointer-events-none">
              <GlassLoop3D size={110} />
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-5">
              Transform your ideas into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] via-[#C026D3] to-[#E11D48]">
                digital success
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto mb-8 leading-relaxed" dir="rtl">
              أشخاص حقيقيون، منتجات ثلاثية الأبعاد وذكاء اصطناعي فائق السرعة عبر Gemini 1.5 Flash مجاناً لمساعدتك في إطلاق مشاريعك ونجاحك الرقمي.
            </p>

            {/* ONE Big Button that returns to chat */}
            <button
              onClick={onStartChat}
              className="px-8 sm:px-11 py-4 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-base sm:text-lg font-bold shadow-xl shadow-[#7C3AED]/25 hover:shadow-2xl hover:shadow-[#7C3AED]/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3 cursor-pointer group"
            >
              <span>ابدأ الشات الآن مجاناً</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* 6 BENTO BOXES WITH REAL HUMANS + REAL PRODUCTS + 3D WIDGETS */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
          {/* BOX 1: Purple (#E8D5FF) - "تخصيص ذكي" (Real girl customizing birthday card on tablet) */}
          <div
            onClick={onStartChat}
            className="md:col-span-12 lg:col-span-5 bento-card rounded-3xl p-6 sm:p-7 bg-[#E8D5FF]/90 border border-white/80 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[360px] cursor-pointer group shadow-sm"
          >
            {/* Top Text Header */}
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-purple-800 bg-white/80 px-3 py-1 rounded-full shadow-xs">
                  Customization · تخصيص ذكي
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-2.5">
                  صمم واصنع بحرية كاملة
                </h3>
                <p className="text-xs sm:text-sm text-purple-900/80 font-medium mt-0.5">
                  تعديل البطاقات والتصاميم بالذكاء الاصطناعي
                </p>
              </div>

              {/* Floating mini tool pills */}
              <div className="flex items-center gap-1.5 bg-white/90 p-1.5 rounded-2xl shadow-xs border border-purple-200/80">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                  <Star className="w-3.5 h-3.5" />
                </div>
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Real Human Photo + Card Product Overlay */}
            <div className="relative z-10 mt-6 rounded-2xl overflow-hidden shadow-md border border-white/80 group-hover:scale-[1.01] transition-transform bg-purple-200/50">
              <div className="relative h-48 sm:h-52 w-full">
                {/* Real photo of creator girl with curly hair focused on digital screen */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
                  alt="Real girl with curly hair customizing digital card"
                  className="w-full h-full object-cover object-top"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-950/80 via-transparent to-black/10" />

                {/* Floating Product Card Mockup Overlay */}
                <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-white/95 backdrop-blur-md border border-white shadow-lg flex items-center justify-between" dir="rtl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-base font-bold shadow-xs">
                      🎉
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">بطاقة تهنئة ذكية (Birthday Card)</div>
                      <div className="text-[10px] text-purple-700 font-semibold">تخصيص كامل للنصوص والتصميم</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    جاهزة للإرسال
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 2: Pink (#FFB5C2) - "سريع كالبرق" (Real hands holding birthday cards + 3D calendar widget) */}
          <div
            onClick={onStartChat}
            className="md:col-span-6 lg:col-span-4 bento-card rounded-3xl p-6 sm:p-7 bg-[#FFB5C2]/90 border border-white/80 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[360px] cursor-pointer group shadow-sm"
          >
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-pink-900 bg-white/80 px-3 py-1 rounded-full shadow-xs">
                  Scheduling · سريع كالبرق
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-2.5">
                  جدولة وتسليم فوري
                </h3>
                <p className="text-xs sm:text-sm text-pink-950/80 font-medium mt-0.5">
                  توليد فوري ومواعيد تسليم دقيقة
                </p>
              </div>

              <div className="w-9 h-9 rounded-2xl bg-white/80 border border-pink-200 flex items-center justify-center text-pink-600 shadow-xs">
                <Calendar className="w-4 h-4 text-pink-600" />
              </div>
            </div>

            {/* Real photo: Hands holding greeting cards + Floating 3D Calendar Widget */}
            <div className="relative z-10 mt-5 rounded-2xl overflow-hidden shadow-md border border-white/80 bg-pink-200/50">
              <div className="relative h-44 sm:h-48 w-full">
                <img
                  src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80"
                  alt="Real hands holding celebration gift cards"
                  className="w-full h-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-pink-950/60 to-transparent" />

                {/* Floating 3D Calendar Widget Overlay */}
                <div className="absolute top-2.5 right-2.5 p-2.5 rounded-xl bg-white/95 backdrop-blur-md border border-white shadow-xl animate-soft-float">
                  <div className="text-[10px] font-bold text-pink-600 uppercase">اليوم · سبتمبر 30</div>
                  <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
                    <span>⚡ 0.2s</span>
                    <span className="text-[10px] text-slate-500 font-normal">استجابة</span>
                  </div>
                </div>

                <div className="absolute bottom-2.5 left-2.5 right-2.5 px-3 py-2 rounded-xl bg-white/90 backdrop-blur-md text-xs font-bold text-slate-800 flex items-center justify-between" dir="rtl">
                  <span>تسليم البطاقات والرسائل الرقمية</span>
                  <span className="text-pink-600 text-[11px]">مجدول بنجاح</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 3: Light Green (#D4F5C5) - "مجاني 100%" (Real wallet cards + $132 / $0.00 with real hand holding) */}
          <div
            onClick={onStartChat}
            className="md:col-span-6 lg:col-span-3 bento-card rounded-3xl p-6 sm:p-7 bg-[#D4F5C5]/90 border border-white/80 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[360px] cursor-pointer group shadow-sm"
          >
            <div className="relative z-10">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-emerald-900 bg-white/80 px-3 py-1 rounded-full shadow-xs">
                Wallet · مجاني 100%
              </span>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-2.5">
                محفظة مجانية
              </h3>
              <p className="text-xs text-emerald-950/80 font-medium mt-0.5">
                رصيد مفتوح بدون بطاقة ائتمان
              </p>
            </div>

            {/* Real photo: Hand holding payment wallet / cards + Large $132.00 / $0.00 badge */}
            <div className="relative z-10 my-3 rounded-2xl overflow-hidden shadow-md border border-white/80 bg-emerald-200/50">
              <div className="relative h-36 w-full">
                <img
                  src="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80"
                  alt="Real hand holding payment card and wallet"
                  className="w-full h-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 via-transparent to-transparent" />

                {/* Balance display badge like Givingli $132.00 / $0.00 */}
                <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md flex items-center justify-between shadow">
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">الرصيد المتاح</div>
                    <div className="text-lg font-black text-emerald-700 leading-none">$132.00</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    مجاني 0.00$
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs text-emerald-900 font-bold">
              <span>دعم شبكة TRC20</span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          {/* BOX 4: Yellow (#FFE78A) - "ذاكرة محادثات" (Real inbox messages with real human avatars) */}
          <div
            onClick={onStartChat}
            className="md:col-span-6 lg:col-span-4 bento-card rounded-3xl p-6 sm:p-7 bg-[#FFE78A]/90 border border-white/80 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[340px] cursor-pointer group shadow-sm"
          >
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-amber-900 bg-white/80 px-3 py-1 rounded-full shadow-xs">
                  Inbox · ذاكرة محادثات
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-2.5">
                  صندوق الرسائل الذكي
                </h3>
                <p className="text-xs sm:text-sm text-amber-950/80 font-medium mt-0.5">
                  محادثات فورية مع بشر ومطورين
                </p>
              </div>

              <div className="w-9 h-9 rounded-2xl bg-white/80 border border-yellow-300 flex items-center justify-center text-amber-600 shadow-xs">
                <MessageSquare className="w-4 h-4 text-amber-600" />
              </div>
            </div>

            {/* Real photo of people collaborating + Real Human Avatar Inbox Cards */}
            <div className="relative z-10 mt-4 rounded-2xl overflow-hidden shadow-md border border-white/80 bg-amber-200/50">
              <div className="relative h-24 w-full">
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=700&q=80"
                  alt="Real diverse team smiling and messaging"
                  className="w-full h-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-white/90 text-[10px] font-extrabold text-slate-900 shadow">
                  3 محادثات نشطة
                </div>
              </div>

              {/* Real Human Avatar message threads */}
              <div className="p-3 bg-white/95 backdrop-blur-md space-y-2" dir="rtl">
                <div className="flex items-center gap-2.5 p-1.5 rounded-xl bg-amber-50/60 border border-amber-100">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
                    alt="Real human avatar Sarah"
                    className="w-8 h-8 rounded-full object-cover border border-white shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                  <div className="truncate flex-1">
                    <div className="text-xs font-bold text-slate-900">سارة المنصوري</div>
                    <div className="text-[10px] text-slate-500 truncate">تم إنشاء خطة المشروع بالكامل!</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                </div>

                <div className="flex items-center gap-2.5 p-1.5 rounded-xl bg-white border border-slate-100">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                    alt="Real human avatar Omar"
                    className="w-8 h-8 rounded-full object-cover border border-white shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                  <div className="truncate flex-1">
                    <div className="text-xs font-bold text-slate-900">عمر الشامي</div>
                    <div className="text-[10px] text-slate-500 truncate">شكراً على كود الـ API النظيف ⚡</div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">10:42</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 5: Orange (#FFC999) - "شارك أفكارك" (Real brand products Nike, Amazon, Starbucks, Target in 3D pile with real hands) */}
          <div
            onClick={onStartChat}
            className="md:col-span-6 lg:col-span-4 bento-card rounded-3xl p-6 sm:p-7 bg-[#FFC999]/90 border border-white/80 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[340px] cursor-pointer group shadow-sm"
          >
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-orange-950 bg-white/80 px-3 py-1 rounded-full shadow-xs">
                  Brands & Gifts · شارك أفكارك
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-2.5">
                  هدايا وعلامات عالمية
                </h3>
                <p className="text-xs sm:text-sm text-orange-950/80 font-medium mt-0.5">
                  Nike, Amazon, Starbucks, Target
                </p>
              </div>

              <div className="w-9 h-9 rounded-2xl bg-white/80 border border-orange-200 flex items-center justify-center text-orange-600 shadow-xs">
                <Gift className="w-4 h-4 text-orange-600" />
              </div>
            </div>

            {/* Real photo of hands holding packages + 3D Brand Cards Pile */}
            <div className="relative z-10 mt-4 rounded-2xl overflow-hidden shadow-md border border-white/80 bg-orange-200/50">
              <div className="relative h-32 w-full">
                <img
                  src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=700&q=80"
                  alt="Real hands with shopping brand gift packages"
                  className="w-full h-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-950/70 via-black/20 to-transparent" />

                {/* 3D floating brand badge pile */}
                <div className="absolute inset-2 flex items-end justify-center gap-1.5 flex-wrap">
                  <div className="px-2.5 py-1 rounded-xl bg-black text-white text-[11px] font-extrabold shadow-lg flex items-center gap-1 transform -rotate-3 hover:rotate-0 transition-transform">
                    <span>NIKE</span>
                    <span className="text-orange-400">✓</span>
                  </div>

                  <div className="px-2.5 py-1 rounded-xl bg-[#232F3E] text-[#FF9900] text-[11px] font-extrabold shadow-lg transform rotate-2 hover:rotate-0 transition-transform">
                    amazon
                  </div>

                  <div className="px-2.5 py-1 rounded-xl bg-[#00704A] text-white text-[11px] font-extrabold shadow-lg transform -rotate-1 hover:rotate-0 transition-transform">
                    Starbucks
                  </div>

                  <div className="px-2.5 py-1 rounded-xl bg-[#CC0000] text-white text-[11px] font-extrabold shadow-lg transform rotate-3 hover:rotate-0 transition-transform">
                    Target
                  </div>
                </div>
              </div>

              {/* Bottom text */}
              <div className="p-2.5 bg-white/95 text-center text-xs font-extrabold text-slate-800">
                بطاقات هدايا وتكاملات رقمية حقيقية
              </div>
            </div>
          </div>

          {/* BOX 6: Light Blue (#C5E8FF) - "تذكير ذكي" (Real iPhone with reminder notification, real person) */}
          <div
            onClick={onStartChat}
            className="md:col-span-12 lg:col-span-4 bento-card rounded-3xl p-6 sm:p-7 bg-[#C5E8FF]/90 border border-white/80 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[340px] cursor-pointer group shadow-sm"
          >
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-blue-900 bg-white/80 px-3 py-1 rounded-full shadow-xs">
                  Reminders · تذكير ذكي
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-2.5">
                  إشعارات iPhone فورية
                </h3>
                <p className="text-xs sm:text-sm text-blue-950/80 font-medium mt-0.5">
                  تذكير بمواعيد إطلاق مشاريعك
                </p>
              </div>

              <div className="w-9 h-9 rounded-2xl bg-white/80 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <Bell className="w-4 h-4 text-blue-600" />
              </div>
            </div>

            {/* Real photo of person holding iPhone with floating reminder overlay */}
            <div className="relative z-10 mt-4 rounded-2xl overflow-hidden shadow-md border border-white/80 bg-blue-200/50">
              <div className="relative h-44 w-full">
                <img
                  src="https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=700&q=80"
                  alt="Real person holding iPhone with notification"
                  className="w-full h-full object-cover"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=700&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/70 via-transparent to-transparent" />

                {/* Floating iOS Reminder Notification Mockup */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 p-3 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-white animate-soft-float-delayed" dir="rtl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-md bg-blue-600 flex items-center justify-center text-white text-[9px]">
                        🔔
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-900">AetherAI Reminder</span>
                    </div>
                    <span className="text-[9px] text-slate-400">الآن</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800">موعد مراجعة خطة إطلاق التطبيق</div>
                  <div className="text-[10px] text-blue-700 font-semibold mt-0.5">إنجاز المهام: 85% مكتمل</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-14 text-center text-xs text-slate-400 font-medium">
          AetherAI © {new Date().getFullYear()} — نموذج Gemini 1.5 Flash مع واجهة Bento 2.0 وأشخاص حقيقيين
        </div>
      </main>
    </div>
  );
};
