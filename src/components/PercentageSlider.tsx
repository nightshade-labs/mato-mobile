import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, View } from 'react-native';

interface PercentageSliderProps {
  value: number;
  onChange: (nextValue: number) => void;
  disabled?: boolean;
}

function clampPercentage(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function PercentageSlider({ value, onChange, disabled = false }: PercentageSliderProps) {
  const trackWidthRef = useRef(1);
  const [trackWidth, setTrackWidth] = useState(1);
  const clampedValue = clampPercentage(value);

  const updateFromTouch = useCallback(
    (locationX: number) => {
      if (disabled) return;
      const width = Math.max(1, trackWidthRef.current);
      const next = clampPercentage((locationX / width) * 100);
      onChange(Number(next.toFixed(2)));
    },
    [disabled, onChange],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    trackWidthRef.current = width;
    setTrackWidth(width);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event) => {
          updateFromTouch(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateFromTouch(event.nativeEvent.locationX);
        },
      }),
    [disabled, updateFromTouch],
  );

  const thumbSize = 20;
  const thumbOffset = (clampedValue / 100) * Math.max(0, trackWidth - thumbSize);

  return (
    <View onLayout={handleLayout} className="h-8 justify-center" {...panResponder.panHandlers}>
      <View className={`h-2 rounded-full ${disabled ? 'bg-gray-200' : 'bg-gray-300'}`}>
        <View
          className={`h-2 rounded-full ${disabled ? 'bg-gray-400' : 'bg-[#512da8]'}`}
          style={{ width: `${clampedValue}%` }}
        />
      </View>
      <View
        pointerEvents="none"
        className={`absolute h-5 w-5 rounded-full border ${
          disabled ? 'bg-gray-200 border-gray-400' : 'bg-white border-[#512da8]'
        }`}
        style={{ left: thumbOffset }}
      />
    </View>
  );
}
