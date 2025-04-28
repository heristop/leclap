import { useState, useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';

type OrientationType = 'portrait' | 'landscape';

export const useOrientation = (requiredOrientation?: OrientationType) => {
  const [currentOrientation, setCurrentOrientation] = useState<OrientationType>(getOrientation());
  const [isCorrectOrientation, setIsCorrectOrientation] = useState<boolean>(
    !requiredOrientation || requiredOrientation === getOrientation()
  );

  function getOrientation(): OrientationType {
    const { width, height } = Dimensions.get('window');
    return height > width ? 'portrait' : 'landscape';
  }

  useEffect(() => {
    const updateOrientation = () => {
      const newOrientation = getOrientation();
      setCurrentOrientation(newOrientation);
      setIsCorrectOrientation(!requiredOrientation || requiredOrientation === newOrientation);
    };

    // Update orientation immediately when component mounts
    updateOrientation();

    // Set up orientation change listener
    const subscription = ScreenOrientation.addOrientationChangeListener(() => {
      updateOrientation();
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, [requiredOrientation]);

  const lockOrientation = async (orientation: OrientationType) => {
    if (orientation === 'portrait') {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  };

  const unlockOrientation = async () => {
    await ScreenOrientation.unlockAsync();
  };

  return {
    currentOrientation,
    isCorrectOrientation,
    lockOrientation,
    unlockOrientation,
  };
};

// Add a dummy export for Expo Router
const OrientationHook = {
  name: 'OrientationHook',
};
export default OrientationHook;
