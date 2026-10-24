import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';
import { glyphParts, hasTint, type GlyphTag, type IconName, type PartRole } from '@leclap/creative-kit/icons';
import { colors, withAlpha } from '@/src/styles/theme';

export type { IconName } from '@leclap/creative-kit/icons';

// The LeClap icons on mobile: the same glyph table as the web app (@leclap/creative-kit/icons), drawn with
// react-native-svg in the duotone style: lines in the icon colour, the glyph's tinted parts in soft lavender,
// or in the brand gradient when the icon marks an active choice.

const SHAPES: Record<GlyphTag, React.ComponentType<Record<string, unknown>>> = {
  path: Path,
  circle: Circle,
  ellipse: Ellipse,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
};

/** A part's paint: solid dots take the line colour, tinted parts the tint, the rest are lines only. */
const fillOf = (role: PartRole, color: string, tint: string): string => {
  if (role.solid) return color;

  if (role.tint) return tint;

  return 'none';
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** The icon marks the active or selected choice: its tint becomes the brand gradient. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Icons are decorative (the control around them carries the label); kept for call-site parity. */
  accessible?: boolean;
}

export function Icon({ name, size = 24, color = colors.text, active = false, style, testID }: IconProps) {
  const gradient = `lc-icon-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const tinted = hasTint(name);
  const tint = active ? `url(#${gradient})` : withAlpha(colors.primary, 0.3);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tinted && active ? (
        <Defs>
          <LinearGradient id={gradient} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.secondary} />
          </LinearGradient>
        </Defs>
      ) : null}
      {glyphParts(name).map(([[tag, attrs], role], index) => {
        const Shape = SHAPES[tag];

        return <Shape key={index} {...attrs} fill={fillOf(role, color, tint)} stroke={role.solid ? 'none' : color} />;
      })}
    </Svg>
  );
}
