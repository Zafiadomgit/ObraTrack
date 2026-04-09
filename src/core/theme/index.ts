export const COLORS = {
  // Primarios
  primary: '#00458B',        // Azul ObraTrack
  primaryDark: '#003366',
  primaryLight: '#3370A8',
  secondary: '#606B7D',      // Gris ObraTrack
  secondaryDark: '#4A5361',
  secondaryLight: '#8C95A3',

  // Superficies
  background: '#0F1923',     // Fondo oscuro
  surface: '#1A2635',        // Tarjetas
  surfaceLight: '#243347',   // Tarjetas elevadas
  border: '#2E4060',

  // Texto
  textPrimary: '#F0F4F8',
  textSecondary: '#8A9BB0',
  textMuted: '#5A7090',

  // Semánticos
  success: '#8DC63F',        // Verde ObraTrack
  warning: '#F39C12',
  danger: '#E74C3C',
  info: '#3498DB',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
  glassBg: 'rgba(26, 38, 53, 0.85)',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 38,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
};
