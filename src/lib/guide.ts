/** The beginner's guide "How to read candlestick charts", in both site languages. */
import type { Lang } from "./lang";

export type GuideSection = { h: string; p: string[]; list?: string[]; ordered?: boolean };
export type GuideText = {
  title: string;
  description: string;
  intro: string;
  anatomy: { green: string; red: string; open: string; close: string; high: string; low: string; body: string; wick: string };
  sections: GuideSection[];
  cta: string;
  ctaText: string;
};

export const CANDLE_GUIDE: Record<Lang, GuideText> = {
  ru: {
    title: "Как читать свечные графики на Скане",
    description:
      "Руководство для новичков: что такое японская свеча, чем отличаются зелёная и красная свечи и как быстро анализировать рынок на графиках Скана.",
    intro:
      "Свечной график — самый популярный способ смотреть на цену у трейдеров. За пять минут вы научитесь его читать и сможете с одного взгляда понимать, что происходит с монетой.",
    anatomy: {
      green: "Зелёная свеча",
      red: "Красная свеча",
      open: "Открытие",
      close: "Закрытие",
      high: "Максимум",
      low: "Минимум",
      body: "Тело",
      wick: "Тень",
    },
    sections: [
      {
        h: "Что такое японская свеча",
        p: [
          "Одна свеча показывает, как двигалась цена за один отрезок времени: 15 минут, час, 4 часа или день. В ней четыре цены: открытия, закрытия, максимум и минимум.",
        ],
        list: [
          "Тело — широкий прямоугольник между ценой открытия и ценой закрытия. Чем длиннее тело, тем сильнее было движение.",
          "Тени (их ещё называют фитилями) — тонкие линии сверху и снизу. Верхняя тень показывает, как высоко цена поднималась, нижняя — как низко опускалась внутри отрезка.",
        ],
      },
      {
        h: "Зелёная и красная свеча",
        p: [
          "Зелёная свеча — цена закрылась выше, чем открылась: за этот отрезок сильнее были покупатели. Открытие — внизу тела, закрытие — вверху.",
          "Красная свеча — наоборот: цена закрылась ниже открытия, сильнее были продавцы. Открытие — вверху тела, закрытие — внизу.",
          "Маленькое тело с длинными тенями означает неуверенность: покупатели и продавцы боролись, и никто не победил.",
        ],
      },
      {
        h: "На что смотреть в первую очередь",
        p: [],
        list: [
          "Тренд. Серия свечей, у которых каждый следующий минимум выше предыдущего, — это рост. Каждый следующий максимум ниже — это падение.",
          "Длинные тени. Длинная нижняя тень у важного уровня говорит, что падение выкупили. Длинная верхняя — что рост продали.",
          "Объём. Столбики под свечами показывают, сколько монет купили и продали. Движение на большом объёме надёжнее, чем на маленьком.",
        ],
      },
      {
        h: "Как пользоваться графиками Скана",
        ordered: true,
        p: [],
        list: [
          "Откройте монету — график сразу показывается свечами, как на бирже. Значок линии рядом с периодами переключает его в простую линию.",
          "Выберите период над графиком: день, неделя, месяц, 3 месяца, год или вся история.",
          "Наведите курсор (на телефоне — коснитесь) на любую свечу: сверху появятся цены открытия, максимума, минимума, закрытия, изменение и объём этой свечи.",
          "Посмотрите на столбики объёма под свечами: зелёные — под растущими свечами, красные — под падающими.",
          "Откройте блок «Разбор ИИ» ниже графика: ИИ прочитает график за вас и скажет, покупать, продавать или подождать, с уровнями входа и стопа.",
        ],
      },
      {
        h: "Частые ошибки новичков",
        p: [],
        list: [
          "Делать выводы по одной свече. Смотрите на несколько свечей подряд и на тренд.",
          "Смотреть только маленький интервал. Проверьте, что показывает дневной график, — он важнее 15-минутного.",
          "Входить в сделку без стопа. Решите заранее, где выйдете, если рынок пойдёт против вас.",
        ],
      },
    ],
    cta: "Открыть график биткоина",
    ctaText: "Попробуйте прямо сейчас: откройте график и наведите курсор на свечи.",
  },
  en: {
    title: "How to read candlestick charts on Scan",
    description:
      "A beginner's guide: what a Japanese candlestick is, the difference between green and red candles and how to analyse the market quickly with Scan's charts.",
    intro:
      "The candlestick chart is traders' favourite way to look at price. In five minutes you'll learn to read it and see at a glance what a coin is doing.",
    anatomy: {
      green: "Green candle",
      red: "Red candle",
      open: "Open",
      close: "Close",
      high: "High",
      low: "Low",
      body: "Body",
      wick: "Wick",
    },
    sections: [
      {
        h: "What a Japanese candlestick is",
        p: [
          "One candle shows how the price moved over one period: 15 minutes, an hour, 4 hours or a day. It holds four prices: open, close, high and low.",
        ],
        list: [
          "The body is the wide box between the open and the close. The longer the body, the stronger the move.",
          "The shadows (also called wicks) are the thin lines above and below. The upper one shows how high the price went, the lower one how low it fell within the period.",
        ],
      },
      {
        h: "Green and red candles",
        p: [
          "A green candle closed higher than it opened: buyers were stronger in that period. The open is at the bottom of the body, the close at the top.",
          "A red candle is the opposite: the price closed below the open and sellers were stronger. The open is at the top of the body, the close at the bottom.",
          "A small body with long wicks means indecision: buyers and sellers fought and neither won.",
        ],
      },
      {
        h: "What to look at first",
        p: [],
        list: [
          "The trend. A run of candles where every low is higher than the one before is a rise; every high lower than the last is a fall.",
          "Long wicks. A long lower wick at an important level says the dip was bought; a long upper one says the rise was sold.",
          "Volume. The bars under the candles show how much was traded. A move on high volume is more reliable than one on low volume.",
        ],
      },
      {
        h: "How to use Scan's charts",
        ordered: true,
        p: [],
        list: [
          "Open a coin — the chart shows candles right away, like on an exchange. The line icon next to the periods switches it to a simple line.",
          "Pick a period above the chart: a day, a week, a month, 3 months, a year or all history.",
          "Hover (or tap on a phone) any candle: its open, high, low, close, change and volume appear at the top.",
          "Look at the volume bars under the candles: green under rising candles, red under falling ones.",
          "Open the «AI analysis» block below the chart: the AI reads the chart for you and says buy, sell or wait, with entry and stop levels.",
        ],
      },
      {
        h: "Common beginner mistakes",
        p: [],
        list: [
          "Drawing conclusions from one candle. Look at several candles in a row and at the trend.",
          "Watching only a short interval. Check the daily chart — it matters more than the 15-minute one.",
          "Trading without a stop. Decide in advance where you'll get out if the market goes against you.",
        ],
      },
    ],
    cta: "Open the Bitcoin chart",
    ctaText: "Try it now: open a chart and hover over the candles.",
  },
};
