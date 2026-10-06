import React from 'react';

const items = [
  { id: 'char_dark_ice_c3256ebd4d660b1f', label: 'Dark ICE', type: 'Character', status: 'ASSET_NOT_AVAILABLE' },
  { id: 'char_maya_unconfirmed', label: 'Maya', type: 'Character / source unconfirmed', status: 'NOT_DETERMINED' },
  { id: 'outfit_milk_re165_b453c59c', label: 'Milk Wedding Dress', type: 'Outfit', status: 'CONVERSION_REQUIRED' },
  { id: 'outfit_maya_re124_0ecf7a74', label: 'Maya Outfit / source package', type: 'Outfit or character — unconfirmed', status: 'CONVERSION_REQUIRED' },
];

export const WardrobeView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <section className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto px-5 pb-24 pt-24 sm:px-10">
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-purple-300/70">Aether Wardrobe</p>
        <h1 className="text-3xl font-light tracking-tight text-white sm:text-5xl">Characters & outfits</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">أصول محفوظة بمعرّفات ثابتة. لا يتم تركيب لباس قبل التحقق من الهيكل العظمي والخامات والتوافق.</p>
      </div>
      <button onClick={onBack} className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/65 transition hover:border-purple-300/40 hover:text-white">Back to room</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="mb-6 flex items-start justify-between gap-3"><div><h2 className="text-lg text-white">{item.label}</h2><p className="mt-1 text-xs text-white/45">{item.type}</p></div><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] tracking-wide text-amber-200/80">{item.status}</span></div>
          <code className="block break-all text-[10px] leading-5 text-white/35">{item.id}</code>
        </article>
      ))}
    </div>
  </section>
);
