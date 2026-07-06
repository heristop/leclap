// Playback-speed control for visual sections: a slider over friendly rate stops (0.25×–4×) that writes
// the descriptor's options.speed (a PTS multiplier — the inversion lives in speedRate.ts, tested).
import { useTranslation } from 'react-i18next';
import { RangeSlider } from '../controls';
import { RATE_STOPS, NORMAL_RATE_INDEX, rateFromSpeed, speedFromRate, nearestRateIndex, formatRate } from './speedRate';

interface SpeedFieldProps {
  speed: number | undefined;
  onChange: (speed: number | undefined) => void;
}

export const SpeedField = ({ speed, onChange }: SpeedFieldProps) => {
  const { t } = useTranslation('admin');
  const index = nearestRateIndex(rateFromSpeed(speed));

  return (
    <div>
      <RangeSlider
        label={t('video.speed')}
        value={index}
        min={0}
        max={RATE_STOPS.length - 1}
        step={1}
        format={(i) => formatRate(RATE_STOPS[i])}
        resetTo={NORMAL_RATE_INDEX}
        onChange={(i) => {
          onChange(speedFromRate(RATE_STOPS[i]));
        }}
      />
      {index !== NORMAL_RATE_INDEX && (
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('video.speedHint')}</span>
      )}
    </div>
  );
};
