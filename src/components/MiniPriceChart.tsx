import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { uiColors } from '../theme/colors';
import type { MiniPriceChartPoint } from '../utils/miniPriceChart';

interface MiniPriceChartProps {
  points: MiniPriceChartPoint[];
  averagePrice: number | null;
  height?: number;
  lineColor?: string;
  averageLineColor?: string;
}

interface ChartSegment {
  key: string;
  left: number;
  top: number;
  width: number;
  rotation: string;
}

interface ChartGeometry {
  averageLineY: number | null;
  segments: ChartSegment[];
}

const VERTICAL_PADDING = 6;
const LINE_THICKNESS = 2;

function buildGeometry(
  points: MiniPriceChartPoint[],
  averagePrice: number | null,
  width: number,
  height: number,
): ChartGeometry | null {
  if (width <= 0 || points.length < 2) return null;

  const values = points.map((point) => point.price);
  if (averagePrice !== null) {
    values.push(averagePrice);
  }

  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  if (minValue === maxValue) {
    const delta = minValue === 0 ? 1 : Math.abs(minValue) * 0.02;
    minValue -= delta;
    maxValue += delta;
  } else {
    const padding = (maxValue - minValue) * 0.08;
    minValue -= padding;
    maxValue += padding;
  }

  const drawableHeight = Math.max(1, height - VERTICAL_PADDING * 2);
  const range = Math.max(1e-9, maxValue - minValue);
  const toY = (value: number) => VERTICAL_PADDING + ((maxValue - value) / range) * drawableHeight;

  const chartPoints = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: toY(point.price),
  }));

  const segments = chartPoints.slice(0, -1).map((point, index) => {
    const nextPoint = chartPoints[index + 1];
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const segmentWidth = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    return {
      key: `${index}-${points[index].slot}-${points[index + 1].slot}`,
      left: (point.x + nextPoint.x) / 2 - segmentWidth / 2,
      top: (point.y + nextPoint.y) / 2 - LINE_THICKNESS / 2,
      width: segmentWidth,
      rotation: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`,
    };
  });

  return {
    averageLineY: averagePrice === null ? null : toY(averagePrice),
    segments,
  };
}

export function MiniPriceChart({
  points,
  averagePrice,
  height = 56,
  lineColor = uiColors.primary,
  averageLineColor = uiColors.warningText,
}: MiniPriceChartProps) {
  const [width, setWidth] = useState(0);
  const geometry = useMemo(() => buildGeometry(points, averagePrice, width, height), [averagePrice, height, points, width]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  };

  return (
    <View
      onLayout={handleLayout}
      className="w-full overflow-hidden rounded-lg"
      style={{
        height,
        borderWidth: 1,
        borderColor: uiColors.border,
        backgroundColor: uiColors.panelSoft,
      }}
    >
      {geometry?.averageLineY !== null && (
        <View
          className="absolute left-0 right-0"
          style={{
            top: geometry.averageLineY,
            borderTopWidth: 1,
            borderTopColor: averageLineColor,
            borderStyle: 'dashed',
            opacity: 0.85,
          }}
        />
      )}

      {geometry?.segments.map((segment) => (
        <View
          key={segment.key}
          className="absolute rounded-full"
          style={{
            left: segment.left,
            top: segment.top,
            width: segment.width,
            height: LINE_THICKNESS,
            backgroundColor: lineColor,
            transform: [{ rotateZ: segment.rotation }],
          }}
        />
      ))}
    </View>
  );
}
