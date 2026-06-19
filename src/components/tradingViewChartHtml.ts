import { uiColors } from '../theme/colors';

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
      background: ${uiColors.chartBackground};
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #chart-container {
      width: ${chartWidth}px;
      height: ${chartHeight}px;
      background: ${uiColors.chartBackground};
      border-radius: 12px;
      overflow: hidden;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: ${uiColors.textMuted};
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
      var PRICE_SCALE_TOUCH_WIDTH_PX = 80;
      var basePriceScaleMargins = {
        top: 0.08,
        bottom: 0.28,
      };
      var priceScaleTopMargin = basePriceScaleMargins.top;
      var PRICE_SCALE_TOP_MIN = 0.02;
      var PRICE_SCALE_TOP_MAX = 0.32;
      var PRICE_SCALE_ZOOM_SENSITIVITY = 0.0015;
      var historyState = {
        hasMore: true,
        loading: false,
        lastRequestAt: 0,
      };
      var touchGesture = {
        active: false,
        mode: 'idle',
        startX: 0,
        startY: 0,
        startTopMargin: 0,
        lastX: 0,
        lastY: 0,
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

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function applyPriceScaleTopMargin(nextTopMargin) {
        if (!chart || !Number.isFinite(nextTopMargin)) return;
        priceScaleTopMargin = clamp(nextTopMargin, PRICE_SCALE_TOP_MIN, PRICE_SCALE_TOP_MAX);
        chart.applyOptions({
          rightPriceScale: {
            autoScale: false,
            scaleMargins: {
              top: priceScaleTopMargin,
              bottom: basePriceScaleMargins.bottom,
            },
          },
        });
      }

      function resetTouchGesture() {
        touchGesture.active = false;
        touchGesture.mode = 'idle';
        touchGesture.startX = 0;
        touchGesture.startY = 0;
        touchGesture.startTopMargin = 0;
        touchGesture.lastX = 0;
        touchGesture.lastY = 0;
      }

      function handleTouchStart(event) {
        if (!event || !event.touches || event.touches.length !== 1 || !container) {
          resetTouchGesture();
          return;
        }

        var touch = event.touches[0];
        var rect = container.getBoundingClientRect();
        var localX = touch.clientX - rect.left;
        var isOnPriceScale = localX >= rect.width - PRICE_SCALE_TOUCH_WIDTH_PX;

        if (isOnPriceScale && chart) {
          chart.applyOptions({
            rightPriceScale: {
              autoScale: false,
              scaleMargins: {
                top: priceScaleTopMargin,
                bottom: basePriceScaleMargins.bottom,
              },
            },
          });
        }

        touchGesture.active = true;
        touchGesture.mode = isOnPriceScale ? 'price-scale' : 'chart-pan';
        touchGesture.startX = touch.clientX;
        touchGesture.startY = touch.clientY;
        touchGesture.startTopMargin = priceScaleTopMargin;
        touchGesture.lastX = touch.clientX;
        touchGesture.lastY = touch.clientY;
      }

      function handleTouchMove(event) {
        if (!touchGesture.active || !event || !event.touches || event.touches.length !== 1) return;

        var touch = event.touches[0];
        if (touchGesture.mode === 'price-scale') {
          event.preventDefault();
          if (typeof event.stopPropagation === 'function') {
            event.stopPropagation();
          }
          var totalDeltaY = touch.clientY - touchGesture.startY;
          var nextTopMargin = touchGesture.startTopMargin - totalDeltaY * PRICE_SCALE_ZOOM_SENSITIVITY;
          applyPriceScaleTopMargin(nextTopMargin);
        }

        touchGesture.lastX = touch.clientX;
        touchGesture.lastY = touch.clientY;
      }

      function resetView() {
        if (!chart) return;
        priceScaleTopMargin = basePriceScaleMargins.top;
        chart.applyOptions({
          rightPriceScale: {
            autoScale: true,
            scaleMargins: {
              top: basePriceScaleMargins.top,
              bottom: basePriceScaleMargins.bottom,
            },
          },
        });
        chart.timeScale().fitContent();
      }

      function handleTouchEnd() {
        resetTouchGesture();
      }

      function registerTouchHandlers() {
        if (!container) return;
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
      }

      function initChart() {
        try {
          chart = LightweightCharts.createChart(container, {
            layout: {
              background: { type: 'solid', color: '${uiColors.chartBackground}' },
              textColor: '${uiColors.textMuted}',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: 12,
            },
            grid: {
              vertLines: { color: '${uiColors.chartGrid}', style: 1 },
              horzLines: { color: '${uiColors.chartGrid}', style: 1 },
            },
            crosshair: {
              mode: 0,
              vertLine: {
                color: '${uiColors.chartCrosshair}',
                width: 1,
                style: 2,
                labelBackgroundColor: '${uiColors.chartBackground}',
              },
              horzLine: {
                color: '${uiColors.chartCrosshair}',
                width: 1,
                style: 2,
                labelBackgroundColor: '${uiColors.chartBackground}',
              },
            },
            handleScroll: {
              horzTouchDrag: true,
              vertTouchDrag: true,
              pressedMouseMove: true,
              mouseWheel: false,
            },
            handleScale: {
              axisPressedMouseMove: true,
              pinch: true,
              mouseWheel: false,
            },
            rightPriceScale: {
              minimumWidth: 74,
              entireTextOnly: true,
              borderColor: '${uiColors.chartGrid}',
              scaleMargins: {
                top: basePriceScaleMargins.top,
                bottom: basePriceScaleMargins.bottom,
              },
            },
            timeScale: {
              borderColor: '${uiColors.chartGrid}',
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
            upColor: '${uiColors.buy}',
            downColor: '${uiColors.sell}',
            borderUpColor: '${uiColors.buy}',
            borderDownColor: '${uiColors.sell}',
            wickUpColor: '${uiColors.buy}',
            wickDownColor: '${uiColors.sell}',
            priceLineVisible: true,
            lastValueVisible: true,
            priceScaleId: 'right',
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
          registerTouchHandlers();

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
          var barsPrepended = 0;
          if (previousFirstTime !== null) {
            for (var idx = 0; idx < formattedCandles.length; idx += 1) {
              if (formattedCandles[idx].time < previousFirstTime) {
                barsPrepended += 1;
              } else {
                break;
              }
            }
          }

          candleSeries.setData(formattedCandles);

          var formattedVolumes = candles.map(function(c) {
            var isUp = Number(c.close) >= Number(c.open);
            return {
              time: Number(c.time),
              value: Number(c.volume || 0),
              color: isUp ? 'rgba(44, 203, 115, 0.4)' : 'rgba(242, 85, 101, 0.4)',
            };
          });
          volumeSeries.setData(formattedVolumes);

          currentDataLength = formattedCandles.length;
          currentFirstTime = formattedCandles[0].time;
          currentLastTime = formattedCandles[formattedCandles.length - 1].time;

          if (
            hasInitialData &&
            previousRange &&
            typeof previousRange.from === 'number' &&
            typeof previousRange.to === 'number'
          ) {
            chart.timeScale().setVisibleLogicalRange({
              from: previousRange.from + barsPrepended,
              to: previousRange.to + barsPrepended,
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
              color: isUp ? 'rgba(44, 203, 115, 0.4)' : 'rgba(242, 85, 101, 0.4)',
            });
          }
        } catch (_) {}
      }

      function handleResize(data) {
        if (!isReady || !chart) return;
        try {
          var width = parseInt(data.width, 10) || ${chartWidth};
          var height = parseInt(data.height, 10) || ${chartHeight};
          container.style.width = width + 'px';
          container.style.height = height + 'px';
          chart.applyOptions({
            width: width,
            height: height,
            rightPriceScale: {
              minimumWidth: 74,
              entireTextOnly: true,
            },
          });
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
            case 'RESET_VIEW':
              resetView();
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
