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
      position: relative;
      width: ${chartWidth}px;
      height: ${chartHeight}px;
      background: ${uiColors.chartBackground};
      border-radius: 12px;
      overflow: hidden;
    }
    #position-overlay {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 5;
    }
    .position-badge {
      position: absolute;
      align-items: center;
      border-radius: 999px;
      border-style: solid;
      border-width: 1px;
      box-shadow: 0 8px 24px -16px rgba(0, 0, 0, 0.9);
      display: flex;
      font-size: 11px;
      font-weight: 700;
      height: 24px;
      justify-content: center;
      line-height: 24px;
      max-width: 148px;
      min-width: 54px;
      overflow: hidden;
      padding: 0 8px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .position-badge-buy {
      background: rgba(31, 215, 154, 0.9);
      border-color: rgba(31, 215, 154, 0.62);
      color: ${uiColors.background};
    }
    .position-badge-sell {
      background: rgba(212, 36, 58, 0.9);
      border-color: rgba(212, 36, 58, 0.62);
      color: ${uiColors.primaryText};
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
    <div id="position-overlay"></div>
  </div>
  <script>
    (function() {
      var chart = null;
      var candleSeries = null;
      var lineSeries = null;
      var volumeSeries = null;
      var isReady = false;
      var pendingData = null;
      var displayMode = 'candles';
      var hasInitialData = false;
      var currentCandles = [];
      var currentDataLength = 0;
      var currentFirstTime = null;
      var currentLastTime = null;
      var positionOverlays = [];
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
      var positionOverlayEl = document.getElementById('position-overlay');

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
        requestRenderPositionOverlays();
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

      function estimateBadgeWidth(label) {
        return Math.min(148, Math.max(54, String(label || '').length * 6.2 + 20));
      }

      function stackPositionBadges(projected, bounds) {
        var occupied = [];
        projected
          .filter(function(overlay) { return overlay.showBadge; })
          .sort(function(left, right) {
            if (Math.abs(left.badgeAnchorX - right.badgeAnchorX) < 1) return left.y - right.y;
            return left.badgeAnchorX - right.badgeAnchorX;
          })
          .forEach(function(overlay) {
            var width = estimateBadgeWidth(overlay.label);
            var left = Math.min(Math.max(overlay.badgeAnchorX - width / 2, 4), Math.max(4, bounds.width - width - 4));
            var preferredTop = Math.max(overlay.y - 38, 4);
            var top = preferredTop;

            for (var index = 0; index < occupied.length; index += 1) {
              var box = occupied[index];
              var overlaps = !(left + width < box.left || left > box.right || top + 24 < box.top || top > box.bottom);
              if (overlaps) {
                top = Math.max(top, box.bottom + 4);
              }
            }

            top = Math.min(Math.max(top, 4), Math.max(4, bounds.height - 28));
            overlay.badgeLeft = left;
            overlay.badgeTop = top;
            overlay.badgeWidth = width;
            occupied.push({ left: left, right: left + width, top: top, bottom: top + 24 });
          });

        return projected;
      }

      function renderPositionOverlays() {
        if (!positionOverlayEl) return;
        positionOverlayEl.innerHTML = '';
        var priceSeries = displayMode === 'line' ? lineSeries : candleSeries;
        if (!chart || !priceSeries || !positionOverlays || positionOverlays.length === 0) return;

        var rect = container.getBoundingClientRect();
        var bounds = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
        var timeScale = chart.timeScale();
        var projected = [];

        for (var index = 0; index < positionOverlays.length; index += 1) {
          var overlay = positionOverlays[index];
          var startX = getInterpolatedTimeCoordinate(Number(overlay.startTime));
          var endX = getInterpolatedTimeCoordinate(Number(overlay.endTime));
          var y = priceSeries.priceToCoordinate(Number(overlay.averagePrice));
          if (startX === null || endX === null || y === null) continue;
          if (!Number.isFinite(startX) || !Number.isFinite(endX) || !Number.isFinite(y)) continue;

          var rawLineEndX = endX <= startX ? startX + 8 : endX;
          var minLineX = Math.min(startX, rawLineEndX);
          var maxLineX = Math.max(startX, rawLineEndX);
          if (maxLineX < 0 || minLineX > bounds.width || y < 0 || y > bounds.height) continue;

          projected.push({
            averagePrice: overlay.averagePrice,
            badgeAnchorX: startX,
            badgeLeft: 0,
            badgeTop: 0,
            badgeWidth: 0,
            endX: Math.min(Math.max(rawLineEndX, 0), bounds.width),
            id: overlay.id,
            label: overlay.label,
            lineColor: overlay.side === 'buy' ? '${uiColors.buy}' : '${uiColors.sell}',
            showBadge: startX >= 0 && startX <= bounds.width,
            side: overlay.side,
            startX: Math.min(Math.max(startX, 0), bounds.width),
            status: overlay.status,
            y: y,
          });
        }

        projected = stackPositionBadges(projected, bounds);
        if (projected.length === 0) return;

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(bounds.width));
        svg.setAttribute('height', String(bounds.height));
        svg.style.position = 'absolute';
        svg.style.inset = '0';

        projected.forEach(function(overlay) {
          var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(overlay.startX));
          line.setAttribute('x2', String(overlay.endX));
          line.setAttribute('y1', String(overlay.y));
          line.setAttribute('y2', String(overlay.y));
          line.setAttribute('stroke', overlay.lineColor);
          line.setAttribute('stroke-linecap', 'round');
          line.setAttribute('stroke-width', '2');
          if (overlay.status === 'active') {
            line.setAttribute('stroke-dasharray', '5 4');
          }
          svg.appendChild(line);
        });
        positionOverlayEl.appendChild(svg);

        projected
          .filter(function(overlay) { return overlay.showBadge; })
          .forEach(function(overlay) {
            var badge = document.createElement('div');
            badge.className = 'position-badge ' + (overlay.side === 'buy' ? 'position-badge-buy' : 'position-badge-sell');
            badge.textContent = overlay.label;
            badge.style.left = overlay.badgeLeft + 'px';
            badge.style.top = overlay.badgeTop + 'px';
            badge.style.width = overlay.badgeWidth + 'px';
            positionOverlayEl.appendChild(badge);
          });
      }

      function requestRenderPositionOverlays() {
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(renderPositionOverlays);
          return;
        }
        setTimeout(renderPositionOverlays, 0);
      }

      function getInterpolatedTimeCoordinate(time) {
        var directCoordinate = chart.timeScale().timeToCoordinate(time);
        if (directCoordinate !== null) return directCoordinate;
        if (!currentCandles || currentCandles.length === 0) return null;

        var upperIndex = currentCandles.findIndex(function(candle) { return Number(candle.time) >= time; });
        if (upperIndex >= 0 && Number(currentCandles[upperIndex].time) === time) {
          return chart.timeScale().timeToCoordinate(Number(currentCandles[upperIndex].time));
        }

        var left = null;
        var right = null;
        if (upperIndex < 0) {
          left = currentCandles[currentCandles.length - 2] || null;
          right = currentCandles[currentCandles.length - 1] || null;
        } else if (upperIndex === 0) {
          left = currentCandles[0] || null;
          right = currentCandles[1] || null;
        } else {
          left = currentCandles[upperIndex - 1] || null;
          right = currentCandles[upperIndex] || null;
        }

        if (!left || !right || Number(left.time) === Number(right.time)) return null;
        var leftX = chart.timeScale().timeToCoordinate(Number(left.time));
        var rightX = chart.timeScale().timeToCoordinate(Number(right.time));
        if (leftX === null || rightX === null) return null;

        var ratio = (time - Number(left.time)) / (Number(right.time) - Number(left.time));
        return leftX + (rightX - leftX) * ratio;
      }

      function applyDisplayMode(nextMode) {
        displayMode = nextMode === 'line' ? 'line' : 'candles';
        if (candleSeries) {
          candleSeries.applyOptions({ visible: displayMode === 'candles' });
        }
        if (lineSeries) {
          lineSeries.applyOptions({ visible: displayMode === 'line' });
        }
        requestRenderPositionOverlays();
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
            visible: true,
          });

          lineSeries = chart.addLineSeries({
            color: '${uiColors.accent}',
            lineWidth: 2,
            priceLineColor: '${uiColors.accent}',
            priceLineVisible: true,
            lastValueVisible: true,
            priceScaleId: 'right',
            visible: false,
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
            var candleData = currentCandles.find(function(candle) { return Number(candle.time) === Number(param.time); });
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
            requestRenderPositionOverlays();
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
          currentCandles = formattedCandles;

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
          lineSeries.setData(formattedCandles.map(function(c) {
            return {
              time: c.time,
              value: c.close,
            };
          }));

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
          requestRenderPositionOverlays();
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
          lineSeries.update({
            time: normalized.time,
            value: normalized.close,
          });
          var existingIndex = currentCandles.findIndex(function(c) { return Number(c.time) === normalized.time; });
          if (existingIndex >= 0) {
            currentCandles[existingIndex] = normalized;
          } else {
            currentCandles.push(normalized);
            currentCandles.sort(function(left, right) { return Number(left.time) - Number(right.time); });
          }
          if (volumeSeries) {
            var isUp = normalized.close >= normalized.open;
            volumeSeries.update({
              time: normalized.time,
              value: Number(candle.volume || 0),
              color: isUp ? 'rgba(44, 203, 115, 0.4)' : 'rgba(242, 85, 101, 0.4)',
            });
          }
          requestRenderPositionOverlays();
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
          requestRenderPositionOverlays();
        } catch (_) {}
      }

      function handlePositionOverlays(data) {
        try {
          positionOverlays = JSON.parse(data.overlays || '[]');
          requestRenderPositionOverlays();
        } catch (_) {
          positionOverlays = [];
          requestRenderPositionOverlays();
        }
      }

      function handleDisplayMode(data) {
        applyDisplayMode(data.mode);
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
            case 'POSITION_OVERLAYS':
              handlePositionOverlays(message);
              break;
            case 'DISPLAY_MODE':
              handleDisplayMode(message);
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
