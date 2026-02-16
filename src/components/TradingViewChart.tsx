import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getTradingViewChartHtml } from './tradingViewChartHtml';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const DEFAULT_WIDTH = width - HORIZONTAL_PADDING * 2;

export interface TradingViewCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingViewCrosshairData {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

interface TradingViewChartProps {
  data: TradingViewCandle[];
  lastCandle?: TradingViewCandle | null;
  onCrosshairMove?: (point: TradingViewCrosshairData | null) => void;
  height?: number;
}

type WebViewInboundMessage =
  | { type: 'CHART_READY' }
  | { type: 'CHART_ERROR'; message?: string }
  | { type: 'CROSSHAIR_MOVE'; data?: TradingViewCrosshairData }
  | { type: 'CROSSHAIR_CLEAR' };

export function TradingViewChart({ data, lastCandle = null, onCrosshairMove, height = 320 }: TradingViewChartProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(DEFAULT_WIDTH);
  const lastCandleRef = useRef<string | null>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const nextWidth = window.width - HORIZONTAL_PADDING * 2;
      setChartWidth(nextWidth);
      if (!isReady || !webViewRef.current) return;

      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'RESIZE',
          width: nextWidth,
          height,
        }),
      );
    });

    return () => {
      subscription.remove();
    };
  }, [height, isReady]);

  useEffect(() => {
    if (!isReady || !webViewRef.current || data.length === 0) return;

    webViewRef.current.postMessage(
      JSON.stringify({
        type: 'INIT_DATA',
        candles: JSON.stringify(data),
      }),
    );
  }, [data, isReady]);

  useEffect(() => {
    if (!isReady || !webViewRef.current || !lastCandle) return;
    const candleKey = `${lastCandle.time}-${lastCandle.close}-${lastCandle.volume}`;
    if (lastCandleRef.current === candleKey) return;
    lastCandleRef.current = candleKey;

    webViewRef.current.postMessage(
      JSON.stringify({
        type: 'UPDATE_CANDLE',
        candle: JSON.stringify(lastCandle),
      }),
    );
  }, [isReady, lastCandle]);

  const handleMessage = (raw: string) => {
    try {
      const message = JSON.parse(raw) as WebViewInboundMessage;
      if (message.type === 'CHART_READY') {
        setIsReady(true);
        setChartError(null);
        return;
      }
      if (message.type === 'CHART_ERROR') {
        setChartError(message.message ?? 'Failed to initialize chart');
        return;
      }
      if (message.type === 'CROSSHAIR_MOVE' && onCrosshairMove) {
        onCrosshairMove(message.data ?? null);
        return;
      }
      if (message.type === 'CROSSHAIR_CLEAR' && onCrosshairMove) {
        onCrosshairMove(null);
      }
    } catch {
      setChartError('Invalid chart response');
    }
  };

  return (
    <View className="bg-[#131722] rounded-xl overflow-hidden relative">
      {!isReady && (
        <View className="absolute inset-0 items-center justify-center z-10 bg-[#131722]">
          <ActivityIndicator size="small" color="#94A3B8" />
          {chartError && <Text className="text-[#94A3B8] text-xs mt-2">{chartError}</Text>}
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ html: getTradingViewChartHtml(chartWidth, height) }}
        style={{ width: chartWidth, height, backgroundColor: '#131722' }}
        scrollEnabled={false}
        nestedScrollEnabled
        bounces={false}
        javaScriptEnabled
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        onMessage={(event) => handleMessage(event.nativeEvent.data)}
        onError={(event) => setChartError(event.nativeEvent.description || 'WebView error')}
        androidLayerType="hardware"
      />
    </View>
  );
}
