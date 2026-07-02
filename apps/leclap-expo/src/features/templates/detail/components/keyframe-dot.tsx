import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, gradientDir } from '@/src/styles/gradients';
import { styles } from '@/src/features/templates/detail/detail.styles';

// The status marker on the filmstrip spine: a filled lavender→pink keyframe when the shot is done, a
// hollow diamond when it's still pending. Replaces the generic checkmark/empty-circle.
export function KeyframeDot({ done }: { done: boolean }) {
  if (done) {
    return (
      <View style={styles.keyframe}>
        <LinearGradient colors={[...gradients.brand]} {...gradientDir.diagonal} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  return <View style={[styles.keyframe, styles.keyframePending]} />;
}

export default KeyframeDot;
