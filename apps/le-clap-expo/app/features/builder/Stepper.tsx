import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/src/styles/theme';

interface StepperProps {
  /** Ordered step labels, e.g. the BUILDER_STEPS from builderModel. */
  steps: readonly string[];
  /** Index of the active step. */
  currentStep: number;
}

/** Screen-reader suffix describing a step's state. */
function stepStateSuffix(active: boolean, done: boolean): string {
  if (active) return ' (current)';
  if (done) return ' (done)';

  return '';
}

/**
 * Compact wizard progress indicator: a row of connected nodes (done / active / upcoming),
 * with the active step named below. Mobile-first — naming only the current step keeps six
 * steps legible on a phone instead of cramming six labels across the width.
 */
export const Stepper = ({ steps, currentStep }: StepperProps) => {
  const total = steps.length;
  const safeCurrent = Math.max(0, Math.min(currentStep, total - 1));

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: safeCurrent + 1 }}>
      <View style={styles.row}>
        {steps.map((label, index) => {
          const isDone = index < safeCurrent;
          const isActive = index === safeCurrent;
          const isLast = index === total - 1;

          return (
            <React.Fragment key={label}>
              <View
                style={[styles.node, isActive && styles.nodeActive, isDone && styles.nodeDone]}
                accessibilityLabel={`${label}${stepStateSuffix(isActive, isDone)}`}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={[styles.nodeNumber, isActive && styles.nodeNumberActive]}>{index + 1}</Text>
                )}
              </View>

              {!isLast && <View style={[styles.connector, index < safeCurrent && styles.connectorDone]} />}
            </React.Fragment>
          );
        })}
      </View>

      <Text style={styles.caption}>
        Step {safeCurrent + 1} of {total} — <Text style={styles.captionStrong}>{steps[safeCurrent]}</Text>
      </Text>
    </View>
  );
};

const NODE_SIZE = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.divider,
  },
  nodeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    transform: [{ scale: 1.12 }],
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  nodeDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nodeNumber: {
    ...typography.smallText,
    fontFamily: typography.button.fontFamily,
    color: colors.textSecondary,
  },
  nodeNumberActive: {
    color: '#fff',
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.divider,
    borderRadius: 1,
  },
  connectorDone: {
    backgroundColor: colors.primary,
  },
  caption: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.s,
  },
  captionStrong: {
    color: colors.text,
    fontFamily: typography.button.fontFamily,
  },
});

export default Stepper;
