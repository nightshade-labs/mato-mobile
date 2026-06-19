import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { uiColors } from '../theme/colors';
import type { MiniPriceChartPoint } from '../utils/miniPriceChart';

interface MiniPriceChartProps {
  points: MiniPriceChartPoint[];
  averagePrice: number | null;
  height?: number;
  lineColor?: string;
  averageLineColor?: string;
  showYAxisLabels?: boolean;
  formatValue?: (value: number) => string;
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
  minValue: number;
  maxValue: number;
  midValue: number;
  plotWidth: number;
}

const VERTICAL_PADDING = 6;
const LINE_THICKNESS = 2;
const AXIS_GUTTER_WIDTH = 54;
const MIN_VISIBLE_RELATIVE_RANGE = 0.000002;
const MIN_VISIBLE_ABSOLUTE_RANGE = 0.000001;

function buildGeometry(
  points: MiniPriceChartPoint[],
  averagePrice: number | null,
  width: number,
  height: number,
  showYAxisLabels: boolean,
): ChartGeometry | null {
  if (width <= 0 || points.length < 2) return null;
  const plotWidth = Math.max(1, width - (showYAxisLabels ? AXIS_GUTTER_WIDTH : 0));

  const values = points.map((point) => point.price);
  if (averagePrice !== null) {
    values.push(averagePrice);
  }

  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  if (minValue !== maxValue) {
    const padding = (maxValue - minValue) * 0.08;
    minValue -= padding;
    maxValue += padding;
  }
  const midValue = (minValue + maxValue) / 2;
  const minimumRange = Math.max(Math.abs(midValue) * MIN_VISIBLE_RELATIVE_RANGE, MIN_VISIBLE_ABSOLUTE_RANGE);
  if (maxValue - minValue < minimumRange) {
    minValue = midValue - minimumRange / 2;
    maxValue = midValue + minimumRange / 2;
  }

  const drawableHeight = Math.max(1, height - VERTICAL_PADDING * 2);
  const range = Math.max(1e-9, maxValue - minValue);
  const toY = (value: number) => VERTICAL_PADDING + ((maxValue - value) / range) * drawableHeight;

  const chartPoints = points.map((point, index) => ({
    x: points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth,
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
    minValue,
    maxValue,
    midValue,
    plotWidth,
    segments,
  };
}

export function MiniPriceChart({
  points,
  averagePrice,
  height = 56,
  lineColor = uiColors.primary,
  averageLineColor = uiColors.warningText,
  showYAxisLabels = false,
  formatValue,
}: MiniPriceChartProps) {
  const [width, setWidth] = useState(0);
  const geometry = useMemo(
    () => buildGeometry(points, averagePrice, width, height, showYAxisLabels),
    [averagePrice, height, points, showYAxisLabels, width],
  );
  const averageLineY = geometry?.averageLineY ?? null;
  const segments = geometry?.segments ?? [];
  const yAxisLabels =
    geometry && formatValue
      ? [
          { key: 'max', value: formatValue(geometry.maxValue), top: VERTICAL_PADDING - 2 },
          { key: 'mid', value: formatValue(geometry.midValue), top: height / 2 - 7 },
          { key: 'min', value: formatValue(geometry.minValue), top: height - VERTICAL_PADDING - 12 },
        ]
      : [];

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
      {averageLineY !== null && (
        <View
          className="absolute left-0"
          style={{
            width: geometry?.plotWidth ?? width,
            top: averageLineY,
            borderTopWidth: 1,
            borderTopColor: averageLineColor,
            borderStyle: 'dashed',
            opacity: 0.85,
          }}
        />
      )}

      {segments.map((segment) => (
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

      {showYAxisLabels && geometry && formatValue && (
        <>
          <View
            className="absolute"
            style={{
              left: geometry.plotWidth,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: uiColors.divider,
            }}
          />
          {yAxisLabels.map((label) => (
            <Text
              key={label.key}
              className="absolute text-[9px] leading-3"
              numberOfLines={1}
              style={{
                left: geometry.plotWidth + 4,
                right: 4,
                top: label.top,
                color: uiColors.textSubtle,
              }}
            >
              {label.value}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}
