import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, View } from 'react-native';
import { uiColors } from '../theme/colors';

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
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(1);
  const trackPageXRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(1);
  const clampedValue = clampPercentage(value);

  const emitFromPageX = useCallback(
    (pageX: number) => {
      if (disabled) return;
      const localX = pageX - trackPageXRef.current;
      const width = Math.max(1, trackWidthRef.current);
      const next = clampPercentage((localX / width) * 100);
      onChange(Number(next.toFixed(2)));
    },
    [disabled, onChange],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(1, event.nativeEvent.layout.width);
    trackWidthRef.current = width;
    setTrackWidth(width);
    trackRef.current?.measureInWindow((x) => {
      if (x !== undefined) trackPageXRef.current = x;
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          trackRef.current?.measureInWindow((x) => {
            if (x !== undefined) trackPageXRef.current = x;
          });
          emitFromPageX(event.nativeEvent.pageX);
        },
        onPanResponderMove: (event) => {
          emitFromPageX(event.nativeEvent.pageX);
        },
      }),
    [disabled, emitFromPageX],
  );

  const THUMB_SIZE = 18;
  const thumbOffset = (clampedValue / 100) * Math.max(0, trackWidth - THUMB_SIZE);

  return (
    <View ref={trackRef} onLayout={handleLayout} className="h-8 justify-center" {...panResponder.panHandlers}>
      <View className="h-1.5 rounded-full" style={{ backgroundColor: uiColors.divider }}>
        <View
          className="h-1.5 rounded-full"
          style={{
            width: `${clampedValue}%`,
            backgroundColor: disabled ? uiColors.disabledBg : uiColors.primary,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        className="absolute rounded-full border-2"
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          left: thumbOffset,
          backgroundColor: disabled ? uiColors.disabledBg : uiColors.primaryText,
          borderColor: disabled ? uiColors.border : uiColors.primary,
        }}
      />
    </View>
  );
}
