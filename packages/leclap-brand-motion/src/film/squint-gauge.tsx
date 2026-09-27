import { interpolate, useCurrentFrame } from 'remotion';
import { YELLOW } from '../brand';
import { OSWALD } from '../fonts';

// The reviewer's squint-o-meter — the films' running gag (a nod to the stress meter in the Opus 5.5
// launch film). Presentational: the caller drives `relief` (0 = squinting, needle in the red and
// jittering; 1 = relieved, needle in the green and a smile), usually with a spring on a cue, and passes
// the label in the film's language.

export const SquintGauge = ({ relief, label, width = 240 }: { relief: number; label: string; width?: number }) => {
  const frame = useCurrentFrame();
  const squinting = relief < 0.05;
  const jitter = squinting ? Math.sin(frame * 1.7) * 4 + Math.sin(frame * 4.3) * 2 : 0;
  const needle = interpolate(relief, [0, 1], [62, -68]) + jitter;
  const smile = interpolate(relief, [0, 1], [-10, 12]);

  return (
    <div style={{ width, textAlign: 'center', fontFamily: OSWALD }}>
      <svg width={width} height={(width * 140) / 240} viewBox="0 0 170 100">
        <defs>
          <linearGradient id="squint-gauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7ee2a8" />
            <stop offset="0.55" stopColor={YELLOW} />
            <stop offset="1" stopColor="#ff5f6d" />
          </linearGradient>
        </defs>
        <path
          d="M15 90 A70 70 0 0 1 155 90"
          fill="none"
          stroke="url(#squint-gauge)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <g transform={`rotate(${needle} 85 90)`}>
          <path d="M85 90 L85 32" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
        </g>
        <circle cx={85} cy={90} r={9} fill="#fff" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 }}>
        <svg width={(width * 40) / 240} height={(width * 40) / 240} viewBox="0 0 30 30">
          <circle cx={15} cy={15} r={13} fill={YELLOW} />
          <ellipse cx={10} cy={12} rx={2} ry={squinting ? 0.9 : 2.4} fill="#231a4d" />
          <ellipse cx={20} cy={12} rx={2} ry={squinting ? 0.9 : 2.4} fill="#231a4d" />
          <path
            d={`M9 20 Q15 ${20 + smile * 0.45} 21 20`}
            fill="none"
            stroke="#231a4d"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: (width * 20) / 240, letterSpacing: 3, color: '#c9cbe0' }}>{label}</span>
      </div>
    </div>
  );
};
