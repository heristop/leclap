import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ARM,
  BOARD,
  BOARD_BOTTOM,
  BOARD_TOP,
  CHEEK,
  DOT,
  OUTLINE,
  PUPIL,
  STRIPE_PERI,
  STRIPE_YELLOW,
  VIEW,
} from '@leclap/creative-kit/clappy';

export type ClappyState = 'welcome' | 'working' | 'success' | 'search' | 'error';

/** The same Clappy as the films and web app. Decorative; accompanying copy carries the state. */
export function Clappy({ size = 112, state = 'welcome' }: { size?: number; state?: ClappyState }) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const reduced = useReducedMotion();
  const tilt = useSharedValue(0);
  useEffect(() => {
    tilt.value =
      reduced || state === 'working'
        ? 0
        : withSequence(withTiming(state === 'success' ? -3 : 2, { duration: 130 }), withTiming(0, { duration: 210 }));
  }, [state, reduced, tilt]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));
  const proud = state === 'success';
  const focused = state === 'working';
  const gradient = `url(#${id}-board)`;
  const leftArm = state === 'welcome' || proud ? 130 : 50;
  const rightArm = proud ? 130 : 50;

  const stick = (y: number) => (
    <G>
      <Rect x={137} y={y + 5} width={372} height={58} rx={18} fill={`url(#${id}-stripes)`} />
      <Rect
        x={132}
        y={y}
        width={372}
        height={58}
        rx={18}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={22}
        strokeLinejoin="round"
      />
    </G>
  );

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View style={[{ width: size, height: (size * VIEW.height) / VIEW.width }, animatedStyle]}>
        <Svg
          width={size}
          height={(size * VIEW.height) / VIEW.width}
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
        >
          <Defs>
            <LinearGradient id={`${id}-board`} x1="0" y1="0" x2="0" y2="1">
              <Stop stopColor={BOARD_TOP} />
              <Stop offset="1" stopColor={BOARD_BOTTOM} />
            </LinearGradient>
            <Pattern
              id={`${id}-stripes`}
              width={96}
              height={96}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-26)"
            >
              <Rect width={96} height={96} fill={STRIPE_YELLOW} />
              <Rect x={48} width={48} height={96} fill={STRIPE_PERI} />
            </Pattern>
          </Defs>
          {[222, 378].map((cx) => (
            <G key={cx}>
              <Ellipse cx={cx + 4} cy={528} rx={44} ry={22} fill={BOARD_BOTTOM} />
              <Ellipse cx={cx} cy={524} rx={44} ry={22} fill="none" stroke={OUTLINE} strokeWidth={13} />
            </G>
          ))}
          {[
            [98, leftArm],
            [502, -rightArm],
          ].map(([x, angle]) => (
            <G key={x} transform={`translate(${x} 344) rotate(${angle})`}>
              <Path d={ARM} fill={gradient} transform="translate(4 4)" />
              <Path d={ARM} fill="none" stroke={OUTLINE} strokeWidth={13} strokeLinejoin="round" />
            </G>
          ))}
          <Path d={BOARD} fill={gradient} transform="translate(6 5)" />
          <Path d={BOARD} fill="none" stroke={OUTLINE} strokeWidth={22} strokeLinejoin="round" />
          {stick(252)}
          <G transform={`rotate(${focused ? -12 : -25} 140 250)`}>{stick(192)}</G>
          <Rect x={95} y={221} width={80} height={96} rx={24} fill={gradient} />
          <Rect x={90} y={216} width={80} height={96} rx={24} fill="none" stroke={OUTLINE} strokeWidth={22} />
          <Circle cx={130} cy={264} r={17} fill={DOT} stroke={OUTLINE} strokeWidth={7} />
          {[240, 360].map((cx) =>
            proud ? (
              <Path
                key={cx}
                d={`M${cx - 26} 406 Q${cx} 378 ${cx + 26} 406`}
                fill="none"
                stroke={OUTLINE}
                strokeWidth={10}
                strokeLinecap="round"
              />
            ) : (
              <G key={cx} transform={`translate(${cx} 396) scale(1 ${focused ? 0.82 : 1})`}>
                <Ellipse rx={33} ry={38} fill={DOT} stroke={OUTLINE} strokeWidth={9} />
                <Ellipse cx={state === 'search' ? 8 : 0} cy={3} rx={22} ry={25} fill={PUPIL} />
                <Circle cx={9} cy={-8} r={9} fill={DOT} />
                <Circle cx={-8} cy={13} r={4.5} fill={DOT} />
              </G>
            )
          )}
          {[186, 414].map((cx) => (
            <Ellipse key={cx} cx={cx} cy={444} rx={27} ry={14} fill={CHEEK} opacity={0.6} />
          ))}
          {proud ? (
            <G>
              <Path d="M274 440 Q300 480 326 440 Z" fill={PUPIL} stroke={OUTLINE} strokeWidth={7} />
              <Path d="M287 458 Q300 471 313 458 Q300 463 287 458 Z" fill={CHEEK} />
            </G>
          ) : (
            <Path
              d={focused ? 'M286 452 L314 452' : 'M278 442 Q289 458 300 445 Q311 458 322 442'}
              fill="none"
              stroke={OUTLINE}
              strokeWidth={9}
              strokeLinecap="round"
            />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}
