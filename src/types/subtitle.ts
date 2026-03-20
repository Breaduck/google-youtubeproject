export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  stroke: {
    enabled: boolean;
    color: string;
    width: number;
  };
  shadow: {
    enabled: boolean;
    color: string;
    x: number;
    y: number;
    blur: number;
  };
  background: {
    enabled: boolean;
    color: string;
    opacity: number;
    borderRadius: number;
    padding: number;
  };
  position: {
    x: number;
    y: number;
    preset: 'top-center' | 'center' | 'bottom-center' | 'bottom-left' | 'bottom-right' | 'custom';
  };
}

export interface SubtitleTemplate {
  id: string;
  name: string;
  category: 'favorite' | 'basic' | 'color' | 'style' | 'variety' | 'cinematic' | 'no-bg' | 'premium' | 'custom';
  style: SubtitleStyle;
  isFavorite?: boolean;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Pretendard',
  fontSize: 54,
  letterSpacing: 0,
  lineHeight: 1.4,
  color: '#FFFFFF',
  stroke: {
    enabled: true,
    color: '#000000',
    width: 2,
  },
  shadow: {
    enabled: false,
    color: '#000000',
    x: 2,
    y: 2,
    blur: 4,
  },
  background: {
    enabled: false,
    color: '#000000',
    opacity: 0.8,
    borderRadius: 8,
    padding: 12,
  },
  position: {
    x: 50,
    y: 85,
    preset: 'bottom-center',
  },
};
