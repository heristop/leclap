import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, gradientDir } from '@/src/styles/gradients';
import { styles } from '@/src/features/templates/detail/detail.styles';

// The status marker on the filmstrip spine: a filled lavender→pink keyframe when the shot is done, a
// hollow diamond when it's still pending. Replaces the generic checkmark/empty-circle.
//
// The gradient carries its own borderRadius; don't clip it with `overflow: 'hidden'` on the rotated
// parent. Rows live inside PressableScale (a reanimated Animated.Pressable driving a UI-thread
// scale), and on Android a clipped child of that subtree stops repainting once the row re-renders —
// the diamond then draws empty.
export function KeyframeDot({ done }: { done: boolean }) {
  if (done) {
    return (
      <View style={styles.keyframe}>
        <LinearGradient
          colors={[...gradients.brand]}
          {...gradientDir.diagonal}
          style={[StyleSheet.absoluteFill, styles.keyframeFill]}
        />
      </View>
    );
  }

  return <View style={[styles.keyframe, styles.keyframePending]} />;
}

export default KeyframeDot;
