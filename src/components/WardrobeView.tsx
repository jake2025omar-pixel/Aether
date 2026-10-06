import React from 'react';

type WardrobeItem = {
  id: string;
  label: string;
  type: string;
  status: string;
  image?: string;
  runtime?: string;
  note: string;
};

const items: WardrobeItem[] = [
  {
    id: 'char_dark_ice_c3256ebd4d660b1f',
    label: 'Dark ICE',
    type: 'Character · VRM 1.0',
    status: 'WEB_READY',
    image: '/assets/characters/dark_ice/dark_ice_thumb.png',
    runtime: '/assets/characters/dark_ice/dark_ice.vrm',
    note: 'الشخصية الأساسية المرتبطة بالصوت والمشاعر وLip Sync.',
  },
  {
    id: 'char_maya_unconfirmed',
    label: 'Maya',
    type: 'Character source · unconfirmed',
    status: 'UNCONFIRMED',
    note: 'الملفات المتاحة تثبت زي Maya فقط، ولا تثبت وجود جسم Maya الكامل.',
  },
  {
    id: 'outfit_milk_re165_b453c59c',
    label: 'Milk RE165 Wedding Dress',
    type: 'Outfit · FBX',
    status: 'RETARGET_REQUIRED',
    image: '/assets/outfits/milk_re165/Milk%20RE165.png',
    runtime: '/assets/outfits/milk_re165/milk%20RE165.fbx',
    note: 'مخصص لأفاتار Milk؛ لا يُركب على Dark ICE تلقائيًا.',
  },
  {
    id: 'outfit_maya_re124_0ecf7a74',
    label: 'Maya RE124',
    type: 'Outfit · FBX',
    status: 'RETARGET_REQUIRED',
    image: '/assets/outfits/maya_re124/Maya%20RE124.png',
    runtime: '/assets/outfits/maya_re124/Maya%20RE124.fbx',
    note: 'زي مخصص لـMaya مع أربعة ألوان؛ يحتاج تحويل GLB قبل العرض ثلاثي الأبعاد.',
  },
];

const statusClass: Record<string, string> = {
  WEB_READY: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200/85',
  RETARGET_REQUIRED: 'border-amber-300/20 bg-amber-300/10 text-amber-200/85',
  UNCONFIRMED: 'border-slate-300/20 bg-slate-300/10 text-slate-200/75',
};

export const WardrobeView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <section className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto px-5 pb-24 pt-24 sm:px-10">
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-purple-300/70">Aether Wardrobe</p>
        <h1 className="text-3xl font-light tracking-tight text-white sm:text-5xl">Characters & outfits</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">الأصول التي تم فحصها فعليًا. لا يتم تركيب زي على شخصية قبل التحقق من الهيكل العظمي والأوزان.</p>
      </div>
      <button onClick={onBack} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/65 transition hover:border-purple-300/40 hover:text-white">Back to room</button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-xl">
          <div className="flex min-h-28 items-center gap-4 border-b border-white/[0.08] p-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/30">
              {item.image ? <img src={item.image} alt={`${item.label} preview`} className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[10px] uppercase tracking-widest text-white/25">No preview</span>}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-lg text-white">{item.label}</h2><span className={`rounded-full border px-2 py-1 text-[9px] tracking-wide ${statusClass[item.status] || 'border-white/10 text-white/55'}`}>{item.status}</span></div>
              <p className="text-xs text-white/45">{item.type}</p>
              <p className="mt-2 text-xs leading-5 text-white/55">{item.note}</p>
            </div>
          </div>
          <div className="space-y-2 p-4"><code className="block break-all text-[10px] leading-5 text-purple-200/55">{item.id}</code>{item.runtime && <code className="block break-all text-[10px] leading-5 text-white/30">{item.runtime}</code>}</div>
        </article>
      ))}
    </div>
  </section>
);
