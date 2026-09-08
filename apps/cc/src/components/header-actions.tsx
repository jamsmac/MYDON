"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ThemeChoice } from "../lib/theme";
import { setTheme } from "../app/theme/actions";
import { Ic } from "./icons";

/** Выбор темы, как его хранит кука: явная светлая/тёмная или «куки нет». */
type ThemeSetting = ThemeChoice | "system";

/**
 * Три состояния — СЛОВАМИ, не иконками: правило среза Д1 (цвет и форма не
 * единственные носители смысла), и переключатель темы обязан читаться в
 * обеих темах. Порядок — от «ничего не выбирал» к явному выбору.
 */
const THEME_OPTIONS: readonly { value: ThemeSetting; word: string }[] = [
  { value: "system", word: "как в системе" },
  { value: "light", word: "светлая" },
  { value: "dark", word: "тёмная" },
];

/** Сужение без `as`: `<select>` отдаёт строку, а action принимает три слова. */
function isThemeSetting(value: string): value is ThemeSetting {
  return THEME_OPTIONS.some((o) => o.value === value);
}

/**
 * Кнопки шапки: поиск, фон, тема, решения. Фон общается с Background событиями
 * и помнит выбор в localStorage `mydon_bg` — тема сюда НЕ переезжает: её
 * читает сервер (кука), чтобы первый кадр уже был нужного цвета.
 *
 * Текущий выбор темы приходит ПРОПСОМ из корневого layout (кука через
 * `cookies()`), а не из `document.documentElement.dataset.theme` и не из
 * заголовка `x-mydon-theme`: оба несут ФАКТИЧЕСКУЮ тему — на /apps без куки
 * это «dark», — а переключатель обязан показывать ВЫБОР («как в системе»),
 * иначе он утверждал бы, что владелец выбирал тёмную. Пропс с сервера ещё и
 * не мигает: контрол верен уже в серверной разметке.
 *
 * Родной `<select>`, а не три чипа: на 390px после лого, «MYDON» и трёх
 * кнопок контролу остаётся ~112px, три слова чипами — ~255px (расчёт в
 * globals.css у правила `.hdr .theme-sw`).
 */
export function HeaderActions({
  pendingCount,
  themeChoice,
}: {
  pendingCount: number;
  themeChoice: ThemeSetting;
}) {
  const router = useRouter();
  const [bgOn, setBgOn] = useState(false);
  const [choice, setChoice] = useState<ThemeSetting>(themeChoice);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = (e: Event) => setBgOn(Boolean((e as CustomEvent).detail));
    window.addEventListener("mydon:bg-state", sync);
    return () => window.removeEventListener("mydon:bg-state", sync);
  }, []);

  /**
   * Инициализатор `useState` выполняется один раз (ловушка App Router, та же,
   * что у тумблеров пауз): после `router.refresh()` layout приносит новый
   * пропс, и контрол обязан перестроиться под сервер — иначе кука, изменённая
   * в другой вкладке, здесь не отразится никогда. При отказе action пропс не
   * меняется, и оптимистичный выбор остаётся на месте.
   */
  useEffect(() => setChoice(themeChoice), [themeChoice]);

  function apply(next: ThemeSetting) {
    // Выбор — в состояние ДО ответа сервера и независимо от него: при отказе
    // контрол показывает то, что владелец выбрал, плюс ошибку (правило форм
    // §7: «поля сохраняют ввод»).
    setChoice(next);
    start(async () => {
      const res = await setTheme(next);
      if (res.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(res.message ?? "Не получилось");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="iconbtn"
        aria-label="Найти карточку или отчёт (⌘K)"
        title="Найти карточку или отчёт  ⌘K"
        onClick={() => window.dispatchEvent(new CustomEvent("mydon:palette-open"))}
      >
        <Ic name="search" />
      </button>
      <button
        type="button"
        className={`iconbtn ${bgOn ? "on" : ""}`}
        aria-label="Фон: небо над Ташкентом"
        onClick={() => window.dispatchEvent(new CustomEvent("mydon:bg-toggle"))}
      >
        <Ic name="sky" />
      </button>
      <select
        className="theme-sw"
        aria-label="Тема"
        title="Тема панели"
        value={choice}
        disabled={pending}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isThemeSetting(next)) apply(next);
        }}
      >
        {THEME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.word}
          </option>
        ))}
      </select>
      {/* `<select>` не шлёт change на уже выбранное значение — повтор нужен
          отдельной кнопкой; это роль кнопки отправки формы. */}
      {error && (
        <button type="button" className="theme-retry err-text" title={error} onClick={() => apply(choice)}>
          {error} · повторить
        </button>
      )}
      <Link href="/inbox" className="iconbtn" aria-label="Входящие">
        <Ic name="bell" />
        {pendingCount > 0 && <span className="cnt">{pendingCount}</span>}
      </Link>
    </>
  );
}
