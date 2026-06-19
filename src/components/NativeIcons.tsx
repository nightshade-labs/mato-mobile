import { View } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
}

export function ChartCandlestickIcon({ color, size = 14 }: IconProps) {
  const bodyWidth = Math.max(3, Math.round(size * 0.22));
  const bodyHeight = Math.max(6, Math.round(size * 0.52));
  const wickHeight = size;

  return (
    <View className="flex-row items-center justify-center" style={{ height: size, width: size }}>
      {[0, 1, 2].map((index) => (
        <View key={index} className="mx-[1px] items-center justify-center" style={{ height: wickHeight }}>
          <View className="absolute rounded-full" style={{ backgroundColor: color, height: wickHeight, width: 1.5 }} />
          <View
            className="rounded-sm"
            style={{
              backgroundColor: color,
              height: index === 1 ? bodyHeight * 0.72 : bodyHeight,
              width: bodyWidth,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export function ChartLineIcon({ color, size = 14 }: IconProps) {
  return (
    <View className="items-center justify-center" style={{ height: size, width: size }}>
      <View
        className="absolute rounded-full"
        style={{
          backgroundColor: color,
          height: 2,
          left: size * 0.08,
          top: size * 0.64,
          transform: [{ rotate: '-35deg' }],
          width: size * 0.42,
        }}
      />
      <View
        className="absolute rounded-full"
        style={{
          backgroundColor: color,
          height: 2,
          right: size * 0.06,
          top: size * 0.36,
          transform: [{ rotate: '28deg' }],
          width: size * 0.48,
        }}
      />
      {[0.12, 0.45, 0.78].map((left, index) => (
        <View
          key={left}
          className="absolute rounded-full"
          style={{
            backgroundColor: color,
            height: 3,
            left: size * left,
            top: index === 0 ? size * 0.68 : index === 1 ? size * 0.46 : size * 0.3,
            width: 3,
          }}
        />
      ))}
    </View>
  );
}

export function ListOrderedIcon({ color, size = 14 }: IconProps) {
  return (
    <View className="justify-center" style={{ height: size, width: size }}>
      {[0, 1, 2].map((index) => (
        <View key={index} className="flex-row items-center" style={{ marginBottom: index === 2 ? 0 : 2 }}>
          <View className="rounded-full" style={{ backgroundColor: color, height: 2.5, width: 2.5 }} />
          <View className="ml-[3px] rounded-full" style={{ backgroundColor: color, height: 1.5, width: size - 5.5 }} />
        </View>
      ))}
    </View>
  );
}

export function RefreshIcon({ color, size = 14 }: IconProps) {
  return (
    <View className="items-center justify-center" style={{ height: size, width: size }}>
      <View
        className="rounded-full"
        style={{
          borderColor: color,
          borderRightColor: 'transparent',
          borderWidth: 1.8,
          height: size - 2,
          transform: [{ rotate: '-35deg' }],
          width: size - 2,
        }}
      />
      <View
        style={{
          borderBottomColor: 'transparent',
          borderBottomWidth: 3,
          borderLeftColor: color,
          borderLeftWidth: 5,
          borderTopColor: 'transparent',
          borderTopWidth: 3,
          position: 'absolute',
          right: 1,
          top: 1,
          transform: [{ rotate: '-20deg' }],
        }}
      />
    </View>
  );
}

export function XIcon({ color, size = 16 }: IconProps) {
  return (
    <View className="items-center justify-center" style={{ height: size, width: size }}>
      <View
        className="absolute rounded-full"
        style={{ backgroundColor: color, height: 1.8, transform: [{ rotate: '45deg' }], width: size }}
      />
      <View
        className="absolute rounded-full"
        style={{ backgroundColor: color, height: 1.8, transform: [{ rotate: '-45deg' }], width: size }}
      />
    </View>
  );
}

export function ChevronIcon({ color, direction, size = 14 }: IconProps & { direction: 'left' | 'right' }) {
  return (
    <View className="items-center justify-center" style={{ height: size, width: size }}>
      <View
        style={{
          borderBottomColor: color,
          borderBottomWidth: 1.8,
          borderLeftColor: color,
          borderLeftWidth: 1.8,
          height: size * 0.52,
          transform: [{ rotate: direction === 'left' ? '45deg' : '-135deg' }],
          width: size * 0.52,
        }}
      />
    </View>
  );
}
