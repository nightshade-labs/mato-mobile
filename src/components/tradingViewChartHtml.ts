export function getTradingViewChartHtml(chartWidth: number, chartHeight: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      background: #131722;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #chart-container {
      width: ${chartWidth}px;
      height: ${chartHeight}px;
      background: #131722;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #94A3B8;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="chart-container">
    <div id="loading">Loading chart...</div>
  </div>
  <script>
    (function() {
      var chart = null;
      var candleSeries = null;
      var volumeSeries = null;
      var isReady = false;
      var pendingData = null;
      var hasInitialData = false;
      var currentDataLength = 0;
      var currentFirstTime = null;
      var currentLastTime = null;
      var HISTORY_LOAD_THRESHOLD_BARS = 20;
      var HISTORY_REQUEST_DEBOUNCE_MS = 600;
      var historyState = {
        hasMore: true,
        loading: false,
        lastRequestAt: 0,
      };
      var container = document.getElementById('chart-container');
      var loadingEl = document.getElementById('loading');

      function postToRN(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function maybeRequestMoreHistory(logicalRange) {
        if (!logicalRange || typeof logicalRange.from !== 'number') return;
        if (!historyState.hasMore || historyState.loading) return;
        if (logicalRange.from > HISTORY_LOAD_THRESHOLD_BARS) return;

        var now = Date.now();
        if (now - historyState.lastRequestAt < HISTORY_REQUEST_DEBOUNCE_MS) return;

        historyState.lastRequestAt = now;
        historyState.loading = true;
        postToRN({ type: 'LOAD_MORE_HISTORY' });
      }

      function initChart() {
        try {
          chart = LightweightCharts.createChart(container, {
            layout: {
              background: { type: 'solid', color: '#131722' },
              textColor: '#94A3B8',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: 12,
            },
            grid: {
              vertLines: { color: '#2B2B43', style: 1 },
              horzLines: { color: '#2B2B43', style: 1 },
            },
            crosshair: {
              mode: 0,
              vertLine: {
                color: '#758696',
                width: 1,
                style: 2,
                labelBackgroundColor: '#131722',
              },
              horzLine: {
                color: '#758696',
                width: 1,
                style: 2,
                labelBackgroundColor: '#131722',
              },
            },
            handleScroll: {
              horzTouchDrag: true,
              vertTouchDrag: false,
              pressedMouseMove: true,
              mouseWheel: false,
            },
            handleScale: {
              axisPressedMouseMove: true,
              pinch: true,
              mouseWheel: false,
            },
            rightPriceScale: {
              borderColor: '#2B2B43',
              scaleMargins: {
                top: 0.08,
                bottom: 0.28,
              },
            },
            timeScale: {
              borderColor: '#2B2B43',
              timeVisible: true,
              secondsVisible: false,
              rightOffset: 6,
              barSpacing: 8,
              minBarSpacing: 4,
              lockVisibleTimeRangeOnResize: true,
            },
            localization: {
              priceFormatter: function(price) {
                return Number(price).toFixed(4);
              },
            },
            width: ${chartWidth},
            height: ${chartHeight},
          });

          candleSeries = chart.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            priceLineVisible: true,
            lastValueVisible: true,
          });

          volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '',
            scaleMargins: {
              top: 0.7,
              bottom: 0,
            },
          });

          volumeSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.76,
              bottom: 0,
            },
          });

          chart.subscribeCrosshairMove(function(param) {
            if (!param || !param.time || !param.seriesData) {
              postToRN({ type: 'CROSSHAIR_CLEAR' });
              return;
            }
            var candleData = param.seriesData.get(candleSeries);
            var volumeData = param.seriesData.get(volumeSeries);
            if (!candleData) {
              postToRN({ type: 'CROSSHAIR_CLEAR' });
              return;
            }

            postToRN({
              type: 'CROSSHAIR_MOVE',
              data: {
                time: param.time,
                open: candleData.open,
                high: candleData.high,
                low: candleData.low,
                close: candleData.close || candleData.value,
                volume: volumeData ? volumeData.value : null,
              }
            });
          });

          chart.timeScale().subscribeVisibleLogicalRangeChange(function(range) {
            maybeRequestMoreHistory(range);
          });

          isReady = true;
          loadingEl.style.display = 'none';
          postToRN({ type: 'CHART_READY' });

          if (pendingData) {
            handleInitData(pendingData);
            pendingData = null;
          }
        } catch (e) {
          postToRN({
            type: 'CHART_ERROR',
            message: String(e && e.message ? e.message : e),
          });
        }
      }

      function handleInitData(data) {
        if (!isReady) {
          pendingData = data;
          return;
        }

        try {
          var candles = JSON.parse(data.candles || '[]');
          if (candles.length === 0) return;

          var formattedCandles = candles.map(function(c) {
            return {
              time: Number(c.time),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            };
          });

          var previousRange = chart.timeScale().getVisibleLogicalRange();
          var previousLength = currentDataLength;
          var previousFirstTime = currentFirstTime;
          var previousLastTime = currentLastTime;

          candleSeries.setData(formattedCandles);

          var formattedVolumes = candles.map(function(c) {
            var isUp = Number(c.close) >= Number(c.open);
            return {
              time: Number(c.time),
              value: Number(c.volume || 0),
              color: isUp ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
            };
          });
          volumeSeries.setData(formattedVolumes);

          currentDataLength = formattedCandles.length;
          currentFirstTime = formattedCandles[0].time;
          currentLastTime = formattedCandles[formattedCandles.length - 1].time;

          var prependedHistory =
            previousLength > 0 &&
            currentDataLength > previousLength &&
            previousFirstTime !== null &&
            currentFirstTime < previousFirstTime &&
            currentLastTime === previousLastTime;

          if (prependedHistory && previousRange && typeof previousRange.from === 'number') {
            var barsAdded = currentDataLength - previousLength;
            chart.timeScale().setVisibleLogicalRange({
              from: previousRange.from + barsAdded,
              to: previousRange.to + barsAdded,
            });
          } else if (!hasInitialData) {
            chart.timeScale().fitContent();
          }

          hasInitialData = true;
        } catch (e) {
          postToRN({
            type: 'CHART_ERROR',
            message: 'Failed to load chart data',
          });
        }
      }

      function handleUpdateCandle(data) {
        if (!isReady || !candleSeries) return;
        try {
          var candle = JSON.parse(data.candle || '{}');
          if (!candle.time) return;
          var normalized = {
            time: Number(candle.time),
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
          };
          candleSeries.update(normalized);
          if (volumeSeries) {
            var isUp = normalized.close >= normalized.open;
            volumeSeries.update({
              time: normalized.time,
              value: Number(candle.volume || 0),
              color: isUp ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
            });
          }
        } catch (_) {}
      }

      function handleResize(data) {
        if (!isReady || !chart) return;
        try {
          var width = parseInt(data.width, 10) || ${chartWidth};
          var height = parseInt(data.height, 10) || ${chartHeight};
          chart.applyOptions({ width: width, height: height });
        } catch (_) {}
      }

      function handleHistoryStatus(data) {
        historyState.hasMore = data.hasMore !== false;
        historyState.loading = Boolean(data.loading);
      }

      function handleRNMessage(event) {
        try {
          var message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!message || !message.type) return;
          switch (message.type) {
            case 'INIT_DATA':
              handleInitData(message);
              break;
            case 'UPDATE_CANDLE':
              handleUpdateCandle(message);
              break;
            case 'RESIZE':
              handleResize(message);
              break;
            case 'HISTORY_STATUS':
              handleHistoryStatus(message);
              break;
            default:
              break;
          }
        } catch (_) {}
      }

      window.addEventListener('message', handleRNMessage);
      document.addEventListener('message', handleRNMessage);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChart);
      } else {
        initChart();
      }
    })();
  </script>
</body>
</html>
`;
}
