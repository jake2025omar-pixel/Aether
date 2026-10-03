/**
 * Aether Centralized Design Tokens
 * Recreated from Quister UI semantic system (UIColors & UITokens)
 */

export const UIColors = {
  // Atmospheric / neon primary accent
  lavender: '#A855F7',
  mintCream: '#E6FFF5',

  // Semantic Typography
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.70)',
  textTertiary: 'rgba(255, 255, 255, 0.40)',

  // Glassmorphic surfaces
  glassBase: 'rgba(18, 12, 28, 0.55)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderHover: 'rgba(168, 85, 247, 0.35)',

  // Deep canvas
  spaceBackground: '#07050D',
  deepSpace: '#0B0814',
} as const;

export const UITokens = {
  // Crystal & Glass Depth Shadows
  crystalShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45), 0 0 30px -4px rgba(168, 85, 247, 0.18)',
  crystalShadowSubtle: '0 4px 20px 0 rgba(0, 0, 0, 0.35)',

  // Spacing & Radius Conventions from Quister
  radius: {
    card: 16,
    hero: 24,
    pill: 9999,
  },
  padding: {
    card: 24,
    hero: 32,
  },

  // Typography Tokens
  typography: {
    heroTitle: {
      fontWeight: 200,
      letterSpacing: '8px',
    },
    splashIconSize: 64,
    heroIconSize: 80,
  },
} as const;
