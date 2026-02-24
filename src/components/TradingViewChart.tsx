import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getTradingViewChartHtml } from './tradingViewChartHtml';
import { uiColors } from '../theme/colors';

const { width } = Dimensions.get('window');
const DEFAULT_WIDTH = width;

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
  onRequestMoreHistory?: () => void;
  hasMoreHistory?: boolean;
  loadingMoreHistory?: boolean;
  height?: number;
}

type WebViewInboundMessage =
  | { type: 'CHART_READY' }
  | { type: 'CHART_ERROR'; message?: string }
  | { type: 'CROSSHAIR_MOVE'; data?: TradingViewCrosshairData }
  | { type: 'CROSSHAIR_CLEAR' }
  | { type: 'LOAD_MORE_HISTORY' };

export function TradingViewChart({
  data,
  lastCandle = null,
  onCrosshairMove,
  onRequestMoreHistory,
  hasMoreHistory = true,
  loadingMoreHistory = false,
  height = 320,
}: TradingViewChartProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(DEFAULT_WIDTH);
  const lastCandleRef = useRef<string | null>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const nextWidth = window.width;
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
    if (!isReady || !webViewRef.current) return;

    webViewRef.current.postMessage(
      JSON.stringify({
        type: 'HISTORY_STATUS',
        hasMore: hasMoreHistory,
        loading: loadingMoreHistory,
      }),
    );
  }, [hasMoreHistory, isReady, loadingMoreHistory]);

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
        return;
      }
      if (message.type === 'LOAD_MORE_HISTORY' && onRequestMoreHistory) {
        onRequestMoreHistory();
      }
    } catch {
      setChartError('Invalid chart response');
    }
  };

  return (
    <View className="overflow-hidden relative" style={{ backgroundColor: uiColors.chartBackground }}>
      {!isReady && (
        <View
          className="absolute inset-0 items-center justify-center z-10"
          style={{ backgroundColor: uiColors.chartBackground }}
        >
          <ActivityIndicator size="small" color={uiColors.textMuted} />
          {chartError && (
            <Text className="text-xs mt-2" style={{ color: uiColors.textMuted }}>
              {chartError}
            </Text>
          )}
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ html: getTradingViewChartHtml(chartWidth, height) }}
        style={{ width: chartWidth, height, backgroundColor: uiColors.chartBackground }}
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
