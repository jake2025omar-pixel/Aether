/**
 * PhonemeLipSyncEngine
 * 
 * Provides phoneme-aligned, letter-by-letter lip synchronization and viseme generation.
 * Maps spoken text characters (Arabic & Latin) to phonetic viseme shapes (aa, ih, ou, ee, oh, closures),
 * modulated by real-time audio amplitude (RMS) and acoustic formant frequencies.
 * 
 * Prevents the mouth from staying statically wide open during speech, enforcing natural
 * closures on bilabial consonants (b, m, p), word spaces, and punctuation pauses.
 */

export interface VisemeFrame {
  mouthOpen: number;
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
}

export interface PhoneticSegment {
  char: string;
  startProgress: number; // 0..1
  endProgress: number;   // 0..1
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
  isClosure: boolean;
}

export class PhoneticLipSyncEngine {
  /**
   * Builds a normalized phonetic timeline from clean spoken text.
   */
  public static buildTimeline(text: string): PhoneticSegment[] {
    const clean = text
      .replace(/\[EMOTION:[^\]]*\]/gi, '')
      .replace(/[*_#`~>]/g, '')
      .trim();

    if (!clean) {
      return [
        {
          char: '',
          startProgress: 0,
          endProgress: 1,
          aa: 0,
          ih: 0,
          ou: 0,
          ee: 0,
          oh: 0,
          isClosure: true,
        },
      ];
    }

    const rawSegments: {
      char: string;
      weight: number;
      aa: number;
      ih: number;
      ou: number;
      ee: number;
      oh: number;
      isClosure: boolean;
    }[] = [];

    // Parse characters and map to phonetic visemes
    for (const ch of Array.from(clean)) {
      // 1. Punctuation pauses (complete lip resting closure)
      if (/[.,!?:;،؟…\-\n]/.test(ch)) {
        rawSegments.push({
          char: ch,
          weight: 1.8,
          aa: 0,
          ih: 0,
          ou: 0,
          ee: 0,
          oh: 0,
          isClosure: true,
        });
        continue;
      }

      // 2. Spaces between words (brief closure / dip between syllables)
      if (/\s/.test(ch)) {
        rawSegments.push({
          char: ' ',
          weight: 0.65,
          aa: 0,
          ih: 0,
          ou: 0,
          ee: 0,
          oh: 0,
          isClosure: true,
        });
        continue;
      }

      // 3. Bilabial consonants: lips touch and close completely (ب, م, b, m, p)
      if (/[بمbmpBMP]/.test(ch)) {
        rawSegments.push({
          char: ch,
          weight: 0.85,
          aa: 0,
          ih: 0,
          ou: 0,
          ee: 0,
          oh: 0,
          isClosure: true,
        });
        continue;
      }

      // 4. Open vowels: wide jaw opening (A, ah, ا, آ, أ, إ, َ, ع, ه, ح)
      if (/[اآأإىءعهحaA\u064E]/.test(ch)) {
        rawSegments.push({
          char: ch,
          weight: 1.35,
          aa: 0.85,
          ih: 0.04,
          ou: 0.02,
          ee: 0.05,
          oh: 0.12,
          isClosure: false,
        });
        continue;
      }

      // 5. Front/spread vowels: wide smile/teeth aperture (I, E, ي, ئ, ِ, e, i, y)
      if (/[يئeiEyY\u0650]/.test(ch)) {
        rawSegments.push({
          char: ch,
          weight: 1.25,
          aa: 0.08,
          ih: 0.82,
          ou: 0.02,
          ee: 0.68,
          oh: 0.04,
          isClosure: false,
        });
        continue;
      }

      // 6. Rounded vowels: pursed/forward lips (U, O, و, ؤ, ُ, u, o, w)
      if (/[وؤuoUOwW\u064F]/.test(ch)) {
        rawSegments.push({
          char: ch,
          weight: 1.3,
          aa: 0.05,
          ih: 0.02,
          ou: 0.88,
          ee: 0.03,
          oh: 0.58,
          isClosure: false,
        });
        continue;
      }

      // 7. Sibilant & dental consonants: teeth slit, minimal aperture (س, ش, ف, ت, etc.)
      if (/[فثصضطظزدذخغقktgdnlszfvjcrKTCGDNLSZFV]/.test(ch)) {
        rawSegments.push({
          char: ch,
          weight: 0.8,
          aa: 0.05,
          ih: 0.22,
          ou: 0.02,
          ee: 0.16,
          oh: 0.02,
          isClosure: false,
        });
        continue;
      }

      // 8. General consonants: moderate neutral articulation
      rawSegments.push({
        char: ch,
        weight: 0.9,
        aa: 0.32,
        ih: 0.20,
        ou: 0.08,
        ee: 0.15,
        oh: 0.10,
        isClosure: false,
      });
    }

    if (rawSegments.length === 0) {
      return [
        {
          char: '',
          startProgress: 0,
          endProgress: 1,
          aa: 0,
          ih: 0,
          ou: 0,
          ee: 0,
          oh: 0,
          isClosure: true,
        },
      ];
    }

    const totalWeight = rawSegments.reduce((sum, s) => sum + s.weight, 0);
    let accum = 0;

    return rawSegments.map((s) => {
      const start = accum / totalWeight;
      accum += s.weight;
      const end = accum / totalWeight;
      return {
        char: s.char,
        startProgress: start,
        endProgress: end,
        aa: s.aa,
        ih: s.ih,
        ou: s.ou,
        ee: s.ee,
        oh: s.oh,
        isClosure: s.isClosure,
      };
    });
  }

  /**
   * Samples the phonetic timeline at the current playback progress (0..1),
   * dynamically modulated by acoustic energy (RMS) and formant frequencies.
   */
  public static sample(
    timeline: PhoneticSegment[],
    progress: number,
    audioRms: number,
    avgFormant = 0,
    avgSibilance = 0
  ): VisemeFrame {
    if (!timeline || timeline.length === 0) {
      return { mouthOpen: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    }

    const clampedProgress = Math.max(0, Math.min(0.9999, progress));
    const segment =
      timeline.find(
        (s) => clampedProgress >= s.startProgress && clampedProgress < s.endProgress
      ) || timeline[timeline.length - 1];

    // If active segment is bilabial consonant or punctuation pause, close lips
    if (segment.isClosure) {
      return { mouthOpen: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    }

    // Gate noise floor: silence or breathing pauses close the mouth
    const noiseFloor = 0.014;
    if (audioRms < noiseFloor) {
      return { mouthOpen: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    }

    // Compute dynamic speech amplitude scalar from RMS
    const energy = audioRms - noiseFloor;
    const amp = Math.min(1.0, Math.max(0.18, energy * 5.2));

    // Acoustic formant modulation
    let aa = segment.aa * amp;
    let ih = segment.ih * amp;
    let ou = segment.ou * amp;
    let ee = segment.ee * amp;
    let oh = segment.oh * amp;

    // High sibilance / friction (>4kHz) pinches lips toward a narrow horizontal slit
    if (avgSibilance > 0.2) {
      aa *= 0.4;
      oh *= 0.4;
      ih = Math.max(ih, 0.18 * amp);
    }

    // Low formant resonance (>500Hz) accentuates open jaw
    if (avgFormant > 0.25) {
      aa = Math.min(0.92, aa * 1.25);
    }

    const maxVowel = Math.max(aa, ih, ou, ee, oh);
    const mouthOpen = Math.min(1.0, maxVowel);

    return {
      mouthOpen,
      aa: Math.min(1, Math.max(0, aa)),
      ih: Math.min(1, Math.max(0, ih)),
      ou: Math.min(1, Math.max(0, ou)),
      ee: Math.min(1, Math.max(0, ee)),
      oh: Math.min(1, Math.max(0, oh)),
    };
  }
}
