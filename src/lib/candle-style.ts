/**
 * The site's candlestick look, shared by every candle chart: exchange-style
 * green/red candles, a dashed last-price line, a full crosshair and a faint
 * ticker watermark. Client-only (canvas charts).
 */
import {
  CrosshairMode,
  LineStyle,
  createTextWatermark,
  type CandlestickSeriesPartialOptions,
  type ChartOptions,
  type DeepPartial,
  type IChartApi,
} from "lightweight-charts";
import { withAlpha, type ChartPalette } from "./theme-colors";

/** Binance's candle colours: bright enough on both the light and the dark surface. */
export const CANDLE_UP = "#0ecb81";
export const CANDLE_DOWN = "#f6465d";

export function candleSeriesOptions(): CandlestickSeriesPartialOptions {
  return {
    upColor: CANDLE_UP,
    downColor: CANDLE_DOWN,
    borderVisible: true,
    borderUpColor: CANDLE_UP,
    borderDownColor: CANDLE_DOWN,
    wickUpColor: CANDLE_UP,
    wickDownColor: CANDLE_DOWN,
    priceLineVisible: true,
    priceLineStyle: LineStyle.Dashed,
    priceLineWidth: 1,
    lastValueVisible: true,
  };
}

/** Grid, crosshair and scales in the same style for every candle chart. */
export function baseChartOptions(p: ChartPalette): DeepPartial<ChartOptions> {
  const line = { color: withAlpha(p.text, 0.55), width: 1 as const, style: LineStyle.Dashed, labelBackgroundColor: p.primary };
  return {
    layout: { background: { color: "transparent" }, textColor: p.text, attributionLogo: false, fontFamily: "Inter Variable, Inter, system-ui, sans-serif", fontSize: 11 },
    grid: { vertLines: { color: withAlpha(p.grid, 0.35) }, horzLines: { color: withAlpha(p.grid, 0.35) } },
    crosshair: { mode: CrosshairMode.Normal, vertLine: line, horzLine: line },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.22 } },
    timeScale: { borderVisible: false, rightOffset: 6, barSpacing: 8, minBarSpacing: 2 },
  };
}

export function volumeColor(up: boolean): string {
  return withAlpha(up ? CANDLE_UP : CANDLE_DOWN, 0.28);
}

/** A large faint ticker in the middle of the chart, like an exchange terminal; returns its remover. */
export function addTickerWatermark(chart: IChartApi, symbol: string | undefined, p: ChartPalette): () => void {
  const pane = chart.panes()[0];
  if (!symbol || !pane) return () => undefined;
  const mark = createTextWatermark(pane, {
    horzAlign: "center",
    vertAlign: "center",
    lines: [{ text: symbol.toUpperCase(), color: withAlpha(p.text, 0.09), fontSize: 64, fontStyle: "700" }],
  });
  return () => mark.detach();
}
