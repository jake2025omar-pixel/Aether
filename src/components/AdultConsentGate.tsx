import { useState } from 'react';

type AdultConsentGateProps = {
  onAccept: () => void;
};

/** Self-attestation gate. Consent is intentionally kept only in the current React session. */
export function AdultConsentGate({ onAccept }: AdultConsentGateProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [adultContentConsent, setAdultContentConsent] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#05030A]/95 px-4 py-8 backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adult-gate-title"
    >
      <section
        dir="rtl"
        className="w-full max-w-lg rounded-[28px] border border-purple-300/20 bg-[#100a18]/95 p-6 text-right text-white shadow-[0_24px_100px_rgba(115,55,190,0.24)] sm:p-8"
      >
        <div className="mb-5 inline-flex rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-purple-100">
          محتوى للبالغين 18+
        </div>
        <h1 id="adult-gate-title" className="text-2xl font-semibold leading-tight sm:text-3xl">
          مرحباً بك في Aether
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/75">
          هذه التجربة مخصصة للبالغين فقط، وتحتوي على رفيقة ذكاء اصطناعي تفاعلية ثلاثية الأبعاد تحاكي علاقة رومانسية وعاطفية وحوارات للكبار.
        </p>
        <div className="mt-6 space-y-3">
          <label htmlFor="adult-age-confirm" className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/90">
            <input
              id="adult-age-confirm"
              type="checkbox"
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.currentTarget.checked)}
              className="mt-1 size-4 shrink-0 accent-purple-400 cursor-pointer"
            />
            <span>أؤكد أن عمري 18 عاماً أو أكثر.</span>
          </label>
          <label htmlFor="adult-content-confirm" className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/90">
            <input
              id="adult-content-confirm"
              type="checkbox"
              checked={adultContentConsent}
              onChange={(event) => setAdultContentConsent(event.currentTarget.checked)}
              className="mt-1 size-4 shrink-0 accent-purple-400 cursor-pointer"
            />
            <span>أوافق بمحض إرادتي على خوض تجربة تفاعلية مخصصة للبالغين.</span>
          </label>
        </div>
        <p className="mt-4 text-xs leading-6 text-white/50">
          تأكيد الموافقة يظل سارياً لجلسة التصفح الحالية فقط ولا يتم تخزين أي بيانات شخصية أو هويات.
        </p>
        <button
          type="button"
          disabled={!ageConfirmed || !adultContentConsent}
          onClick={onAccept}
          className="mt-6 w-full rounded-2xl bg-purple-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-purple-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-200 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer active:scale-[0.99]"
        >
          الدخول إلى Aether
        </button>
      </section>
    </div>
  );
}
