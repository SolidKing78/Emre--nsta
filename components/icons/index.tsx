import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * Instagram-style line icons drawn from scratch (no brand assets copied).
 * All icons share a 24x24 viewBox and inherit `color` for stroke/fill.
 */
export interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
  strokeWidth?: number;
}

const base = (props: IconProps) => ({
  width: props.size ?? 24,
  height: props.size ?? 24,
  viewBox: '0 0 24 24',
});

export function HomeIcon({ size, color = '#000', filled = false, strokeWidth = 2 }: IconProps) {
  if (filled) {
    return (
      <Svg {...base({ size })}>
        <Path
          d="M22 23h-6.001a1 1 0 0 1-1-1v-5.455a2.997 2.997 0 1 0-5.993 0V22a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V11.543a1.002 1.002 0 0 1 .31-.724l10-9.543a1.001 1.001 0 0 1 1.38 0l10 9.543a1.002 1.002 0 0 1 .31.724V22a1 1 0 0 1-1 1Z"
          fill={color}
        />
      </Svg>
    );
  }
  return (
    <Svg {...base({ size })}>
      <Path
        d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V11.543L12 2 2 11.543V22h7.005Z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function SearchIcon({ size, color = '#000', filled = false, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={filled ? strokeWidth + 1 : strokeWidth}
      />
      <Line x1="16.511" x2="22" y1="16.511" y2="22" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={filled ? strokeWidth + 1 : strokeWidth} />
    </Svg>
  );
}

export function ChartIcon({ size, color = '#000', filled = false, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Rect x="2.5" y="3" width="19" height="18" rx="4" fill={filled ? color : 'none'} stroke={color} strokeWidth={strokeWidth} />
      <Polyline
        points="6.5,15.5 10,11 13,13.5 17.5,8"
        fill="none"
        stroke={filled ? '#FFFFFF' : color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function ReelsIcon({ size, color = '#000', filled = false, strokeWidth = 2 }: IconProps) {
  if (filled) {
    return (
      <Svg {...base({ size })}>
        <Path
          d="M12.823 1l2.974 5.002h-5.58l-2.65-4.971c.206-.013.419-.022.642-.027L8.55 1Zm2.327 0h.298c3.06 0 4.468.754 5.64 1.887a6.007 6.007 0 0 1 1.596 2.82l.07.295h-4.629L15.15 1Zm-9.667.377L7.95 6.002H1.244a6.01 6.01 0 0 1 3.942-4.53Zm9.735 12.834-4.545-2.624a.909.909 0 0 0-1.356.668l-.008.12v5.248a.91.91 0 0 0 1.255.84l.109-.053 4.545-2.624a.909.909 0 0 0 .1-1.507l-.1-.068-4.545-2.624Zm-14.2-6.209h21.964l.015.36.003.189v6.899c0 3.061-.755 4.469-1.888 5.64-1.151 1.114-2.5 1.856-5.33 1.909l-.334.003H8.551c-3.06 0-4.467-.755-5.64-1.889-1.114-1.15-1.854-2.498-1.908-5.33L1 15.45V8.551l.003-.189Z"
          fill={color}
        />
      </Svg>
    );
  }
  return (
    <Svg {...base({ size })}>
      <Line x1="2.049" x2="21.95" y1="7.002" y2="7.002" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="13.504" x2="16.362" y1="2.001" y2="7.002" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="7.207" x2="10.002" y1="2.11" y2="7.002" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path
        d="M2 12.001v3.449c0 2.849.698 4.006 1.606 4.945.94.908 2.098 1.607 4.946 1.607h6.896c2.848 0 4.006-.699 4.946-1.607.908-.939 1.606-2.096 1.606-4.945V8.552c0-2.848-.698-4.006-1.606-4.945C19.454 2.699 18.296 2 15.448 2H8.552c-2.848 0-4.006.699-4.946 1.607C2.698 4.546 2 5.704 2 8.552Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M9.763 17.664a.908.908 0 0 1-.454-.787V11.63a.909.909 0 0 1 1.364-.788l4.545 2.624a.909.909 0 0 1 0 1.575l-4.545 2.624a.91.91 0 0 1-.91 0Z"
        fill={color}
      />
    </Svg>
  );
}

export function HeartIcon({ size, color = '#000', filled = false, strokeWidth = 2 }: IconProps) {
  if (filled) {
    return (
      <Svg width={size ?? 24} height={size ?? 24} viewBox="0 0 48 48">
        <Path
          d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"
          fill={color}
        />
      </Svg>
    );
  }
  return (
    <Svg {...base({ size })}>
      <Path
        d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z"
        fill={color}
        stroke="none"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function PlusSquareIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M2 12v3.45c0 2.849.698 4.005 1.606 4.944.94.909 2.098 1.608 4.946 1.608h6.896c2.848 0 4.006-.7 4.946-1.608C21.302 19.455 22 18.3 22 15.45V8.552c0-2.849-.698-4.006-1.606-4.945C19.454 2.7 18.296 2 15.448 2H8.552c-2.848 0-4.006.699-4.946 1.607C2.698 4.547 2 5.703 2 8.552Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Line x1="6.545" x2="17.455" y1="12.001" y2="12.001" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="12.003" x2="12.003" y1="6.545" y2="17.455" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CommentIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function ShareIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Line x1="22" x2="9.218" y1="3" y2="10.083" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Polygon
        points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function BookmarkIcon({ size, color = '#000', filled = false, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polygon
        points="20 21 12 13.44 4 21 4 3 20 3 20 21"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function MoreIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="6" cy="12" r="1.5" fill={color} />
      <Circle cx="18" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}

export function GridIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="9.015" x2="9.015" y1="3" y2="21" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="14.985" x2="14.985" y1="3" y2="21" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="21" x2="3" y1="9.015" y2="9.015" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="21" x2="3" y1="14.985" y2="14.985" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function InsightsIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Line x1="4" x2="4" y1="20" y2="12" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth + 0.5} />
      <Line x1="10.5" x2="10.5" y1="20" y2="4" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth + 0.5} />
      <Line x1="17" x2="17" y1="20" y2="8" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth + 0.5} />
      <Line x1="2" x2="22" y1="21" y2="21" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ChevronLeftIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="16.5 3 7.5 12 16.5 21" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ChevronRightIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="8 3 17 12 8 21" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ChevronDownIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="4 8.5 12 16.5 20 8.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CloseIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Line x1="5" y1="5" x2="19" y2="19" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="19" y1="5" x2="5" y2="19" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CheckIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="4 12.5 9.5 18 20 6" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function VerifiedIcon({ size = 14, color = '#0095F6' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path
        d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z"
        fill={color}
        fillRule="evenodd"
      />
    </Svg>
  );
}

export function LinkIcon({ size = 14, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function MenuIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Line x1="3" x2="21" y1="4" y2="4" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="3" x2="21" y1="12" y2="12" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="3" x2="21" y1="20" y2="20" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function PlayIcon({ size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M5.888 22.5a3.46 3.46 0 0 1-1.721-.46l-.003-.002a3.451 3.451 0 0 1-1.72-2.982V4.943a3.445 3.445 0 0 1 5.163-2.987l12.226 7.059a3.444 3.444 0 0 1-.001 5.967l-12.22 7.056a3.462 3.462 0 0 1-1.724.462Z" fill={color} />
    </Svg>
  );
}

export function CarouselIcon({ size, color = '#fff' }: IconProps) {
  return (
    <Svg viewBox="0 0 48 48" width={size ?? 24} height={size ?? 24}>
      <Path
        d="M34.8 29.7V11c0-2.9-2.3-5.2-5.2-5.2H11c-2.9 0-5.2 2.3-5.2 5.2v18.7c0 2.9 2.3 5.2 5.2 5.2h18.7c2.8-.1 5.1-2.4 5.1-5.2zM39.2 15v16.1c0 4.5-3.7 8.2-8.2 8.2H14.9c-.6 0-.9.7-.5 1.1 1 1.1 2.4 1.8 4.1 1.8h13.4c5.7 0 10.3-4.6 10.3-10.3V18.5c0-1.6-.7-3.1-1.8-4.1-.5-.4-1.2 0-1.2.6z"
        fill={color}
      />
    </Svg>
  );
}

export function ReelBadgeIcon({ size = 18, color = '#fff' }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M12.823 1l2.974 5.002h-5.58l-2.65-4.971c.206-.013.419-.022.642-.027L8.55 1Zm2.327 0h.298c3.06 0 4.468.754 5.64 1.887a6.007 6.007 0 0 1 1.596 2.82l.07.295h-4.629L15.15 1Zm-9.667.377L7.95 6.002H1.244a6.01 6.01 0 0 1 3.942-4.53Zm9.735 12.834-4.545-2.624a.909.909 0 0 0-1.356.668l-.008.12v5.248a.91.91 0 0 0 1.255.84l.109-.053 4.545-2.624a.909.909 0 0 0 .1-1.507l-.1-.068-4.545-2.624Zm-14.2-6.209h21.964l.015.36.003.189v6.899c0 3.061-.755 4.469-1.888 5.64-1.151 1.114-2.5 1.856-5.33 1.909l-.334.003H8.551c-3.06 0-4.467-.755-5.64-1.889-1.114-1.15-1.854-2.498-1.908-5.33L1 15.45V8.551l.003-.189Z"
        fill={color}
      />
    </Svg>
  );
}

export function PinIcon({ size = 16, color = '#fff' }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M14.5 2.5 21.5 9.5l-3 1-3.5 5 .5 4-2-2-5-5-3 .5 1-3 5-3.5 1-3Zm-8 12 -4 7 7-4" fill={color} stroke={color} strokeLinejoin="round" strokeWidth={1} />
    </Svg>
  );
}

export function LockIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EditIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function FlaskIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M9 3h6M10 3v6.2a2 2 0 0 1-.27 1L4.7 18.9A2 2 0 0 0 6.42 22h11.16a2 2 0 0 0 1.72-3.1l-5.03-8.7a2 2 0 0 1-.27-1V3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Line x1="7" y1="16" x2="17" y2="16" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function InfoIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="12" y1="11" x2="12" y2="16.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Circle cx="12" cy="8" r="1.1" fill={color} />
    </Svg>
  );
}

export function RefreshIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Polyline points="20 3 20 8 15 8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CameraIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle cx="12" cy="13" r="3.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ImageIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="8.5" cy="9.5" r="1.5" fill={color} />
      <Path d="M21 15.5 16.5 11 8 19.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ExternalIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M14 4h6v6M20 4l-9 9" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M19 14v4.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function TrendUpIcon({ size = 12, color = '#000', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="3 17 10 10 14 14 21 7" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Polyline points="15 7 21 7 21 13" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function TrendDownIcon({ size = 12, color = '#000', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="3 7 10 14 14 10 21 17" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Polyline points="15 17 21 17 21 11" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function UserPlusIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Circle cx="10" cy="8" r="4" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3 20a7 7 0 0 1 14 0" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="19" y1="8" x2="19" y2="14" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="16" y1="11" x2="22" y2="11" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function SparkIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7L12 2Z" fill={color} />
      <Path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" fill={color} />
    </Svg>
  );
}

export function UserIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="10" r="3.2" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M6.2 18.2a6.5 6.5 0 0 1 11.6 0" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ShopIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M4 9.5 5.2 4h13.6L20 9.5" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5S14 10.9 14 9.5c0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M5.5 12v8h13v-8" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M10 20v-5h4v5" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function TaggedIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M10.201 3.797 12 1.997l1.799 1.8a1.59 1.59 0 0 0 1.124.465h5.259A1.818 1.818 0 0 1 22 6.08v14.104a1.818 1.818 0 0 1-1.818 1.818H3.818A1.818 1.818 0 0 1 2 20.184V6.08a1.818 1.818 0 0 1 1.818-1.818h5.26a1.59 1.59 0 0 0 1.123-.465Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M18.598 22.002V21.4a3.949 3.949 0 0 0-3.948-3.949H9.495A3.949 3.949 0 0 0 5.546 21.4v.603" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Circle cx="12.072" cy="11.075" r="3.556" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EyeIcon({ size = 14, color = '#fff', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function HistoryIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Polyline points="3 3.5 3.5 8 8 7.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Polyline points="12 7.5 12 12 15.5 14" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function GraduationIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M2 9.5 12 4.5l10 5-10 5-10-5Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M6.5 11.8v4.2c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.2" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="22" y1="9.5" x2="22" y2="15" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function BulbIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M8.5 15.5a6 6 0 1 1 7 0c-.8.6-1 1.3-1 2.2h-5c0-.9-.2-1.6-1-2.2Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="9.5" y1="20.5" x2="14.5" y2="20.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function HandshakeIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Polyline points="3 12 7 8 11 12" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Circle cx="16.5" cy="7.5" r="3" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M11 19.5a5.5 5.5 0 0 1 11 0" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function TargetIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="5.5" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

export function TrialReelsIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke={color} strokeDasharray="3 2.5" strokeWidth={strokeWidth} />
      <Path d="M10 8.5v7l5.5-3.5L10 8.5Z" fill={color} />
    </Svg>
  );
}

export function GearIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Circle cx="12" cy="12" r="3.2" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 2.5l1.6 2.4 2.8-.6.9 2.7 2.7.9-.6 2.8 2.4 1.6-2.4 1.6.6 2.8-2.7.9-.9 2.7-2.8-.6L12 21.5l-1.6-2.4-2.8.6-.9-2.7-2.7-.9.6-2.8L2.2 12l2.4-1.6-.6-2.8 2.7-.9.9-2.7 2.8.6L12 2.5Z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

/** Instagram's repost / reshare icon (two arrows chasing each other). */
export function RepostIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M17 2.5l3.5 3.5-3.5 3.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M20.5 6H9a4 4 0 0 0-4 4v1.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M7 21.5L3.5 18 7 14.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M3.5 18H15a4 4 0 0 0 4-4v-1.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Muted speaker shown on feed videos. */
export function MuteIcon({ size, color = '#fff', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z" fill={color} stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Line x1="15.5" y1="9.5" x2="20.5" y2="14.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="20.5" y1="9.5" x2="15.5" y2="14.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Post "more" control as drawn in the current Instagram feed (two short lines). */
export function MoreLinesIcon({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Line x1="4" y1="9.5" x2="20" y2="9.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Line x1="9" y1="14.5" x2="20" y2="14.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Sticker / emoji picker icon in the comment composer. */
export function StickerIcon({ size, color = '#000', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M12 3a9 9 0 1 0 9 9V12a9 9 0 0 0-9-9z" fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M21 12h-4a5 5 0 0 0-5 5v4" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Circle cx="8.6" cy="10" r="1.2" fill={color} />
      <Circle cx="14.2" cy="8.4" r="1.2" fill={color} />
      <Path d="M8 14.5c.9 1.2 2.3 1.9 3.8 1.9" fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Music note used on the "♫ artist · song" line under a username. */
export function MusicNoteIcon({ size, color = '#000' }: IconProps) {
  return (
    <Svg {...base({ size })}>
      <Path d="M9 18.5a3 3 0 1 1-2-2.83V5.2l12-2.4v12.7a3 3 0 1 1-2-2.83V6.3L9 7.7v10.8z" fill={color} />
    </Svg>
  );
}
