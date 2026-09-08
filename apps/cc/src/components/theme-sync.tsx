"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { THEME_COOKIE, isConsoleRoute, themeFor } from "../lib/theme";

/**
 * Значение куки темы из `document.cookie` — простой разбор, без библиотек.
 *
 * Возвращается СЫРАЯ строка, а не `ThemeChoice`: что считать законным
 * значением, решает одна функция `themeFor` (общая с middleware), и второй
 * проверки здесь быть не должно — иначе клиент и сервер разошлись бы на
 * первом же новом значении.
 */
function кукаТемы(): string | undefined {
  const ключ = `${THEME_COOKIE}=`;
  for (const часть of document.cookie.split(";")) {
    const пара = часть.trim();
    if (пара.startsWith(ключ)) return пара.slice(ключ.length);
  }
  return undefined;
}

/**
 * Тема при SPA-навигации (срез Д2, Р-Д2-4).
 *
 * Первый кадр держит сервер: middleware кладёт `themeFor(...)` в заголовок,
 * корневой layout ставит `data-theme` на `<html>` и `data-console` на `.app`
 * прямо в разметке. Но корневой layout НЕ ПЕРЕРИСОВЫВАЕТСЯ при переходе между
 * страницами — без этого компонента `data-theme="dark"` с `/apps` остался бы
 * на `/stock`. Поэтому при каждой смене `pathname` те же два атрибута ставятся
 * заново ТЕМ ЖЕ правилом `themeFor`: модуль без серверных импортов, его
 * читают и middleware, и клиент, и правило у них одно.
 *
 * Cleanup'а («вернуть прежнее значение при размонтировании»), который был у
 * прежнего постраничного штампа темы (до Д2 он стоял на пяти страницах и
 * снимал `data-theme` при уходе с них), здесь НЕТ, и это не упущение:
 * компонент стоит в корневом layout один раз и не размонтируется, а нужное
 * значение ставит сам при каждой смене маршрута — восстанавливать нечего и
 * некому. Снимок «прежнего» к тому же врал бы после смены куки
 * переключателем: штамп при уходе со страницы затёр бы явный выбор
 * пользователя устаревшим снимком.
 *
 * `useLayoutEffect`, а не `useEffect`: атрибуты меняются до отрисовки нового
 * экрана, и кадра «новая страница в теме старой» нет. На сервере React 19
 * этот хук не выполняет и не предупреждает.
 */
export function ThemeSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const html = document.documentElement;
    const тема = themeFor(pathname, кукаТемы());
    if (тема === null) delete html.dataset.theme;
    else html.dataset.theme = тема;

    const app = document.querySelector(".app");
    if (app instanceof HTMLElement) {
      if (isConsoleRoute(pathname)) app.dataset.console = "true";
      else delete app.dataset.console;
    }
  }, [pathname]);

  return null;
}
