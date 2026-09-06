import { vi } from "vitest";

/**
 * Заглушки браузерного окружения для экранов с холстом («Мозг»).
 *
 * jsdom не рисует: у `<canvas>` нет 2D-контекста, нет `ResizeObserver` и нет
 * `matchMedia`. Без них тест падал бы на отрисовке, ничего не сказав о
 * поведении экрана — а проверять мы хотим поведение, а не пиксели.
 *
 * Живёт отдельным файлом, потому что нужен уже двум наборам тестов (компонент
 * графа и страница `/brain`): скопированные 40 строк заглушек разъезжаются.
 */
export function stubCanvasEnvironment() {
  const ctx = {
    canvas: { width: 800, height: 520 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  // Контекст возвращаем вызывающему: по вызовам `scale`/`arc` тест видит, что
  // компонент ДЕЙСТВИТЕЛЬНО перерисовал холст (например, после кнопки
  // масштаба), а не только не упал.
  return ctx;
}
