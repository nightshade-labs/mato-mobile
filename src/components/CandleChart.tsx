import React from 'react';
import { View } from 'react-native';
import { CandlestickChart } from 'react-native-wagmi-charts';
import type { TCandle } from 'react-native-wagmi-charts';

interface CandleChartProps {
  data: TCandle[];
  height?: number;
}

export function CandleChart({ data, height = 300 }: CandleChartProps) {
  return (
    <CandlestickChart.Provider data={data}>
      <CandlestickChart height={height}>
        <CandlestickChart.Candles positiveColor="#22c55e" negativeColor="#ef4444" />
        <CandlestickChart.Crosshair>
          <CandlestickChart.Tooltip />
        </CandlestickChart.Crosshair>
      </CandlestickChart>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4 }}
      >
        <CandlestickChart.PriceText style={{ color: '#999', fontSize: 12 }} />
        <CandlestickChart.DatetimeText style={{ color: '#999', fontSize: 12 }} />
      </View>
    </CandlestickChart.Provider>
  );
}
