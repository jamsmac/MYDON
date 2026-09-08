import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_HEADER, THEME_COOKIE, THEME_HEADER, isConsoleRoute, themeFor } from "./lib/theme";

/**
 * Штамп темы ДО первого кадра (Р-Д2-1, Р-Д2-2).
 *
 * Корневой layout не знает адреса запроса (у серверного layout нет
 * `usePathname`, а `headers()` пути не несёт) и он один на оба мира — тёмный
 * командный центр и светлые бизнес-экраны. Поэтому тема вычисляется здесь, где
 * есть и адрес, и кука, и едет в layout заголовком ЗАПРОСА:
 * `NextResponse.next({ request })` подменяет заголовки для серверного рендера,
 * и `headers()` в layout отдаёт их как пришедшие с клиента. Заголовок всегда
 * ПЕРЕЗАПИСЫВАЕТСЯ, а не дописывается: клиент может прислать свой
 * `x-mydon-theme`, и он не должен дойти до разметки.
 *
 * Прокси, а не route groups: перенос двадцати страниц в `(console)/` и
 * `(business)/` изменил бы двадцать файлов с относительными импортами ради
 * того же результата (решение контроллера 2). Это Next 16 `proxy`: прежнее имя
 * `middleware` объявлено устаревшим, рантайм — Node, не edge.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const cookie = request.cookies.get(THEME_COOKIE)?.value;
  const headers = new Headers(request.headers);
  headers.set(THEME_HEADER, themeFor(pathname, cookie) ?? "system");
  headers.set(CONSOLE_HEADER, isConsoleRoute(pathname) ? "1" : "0");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /*
   * Только страницы. Исключены: `_next/*` (чанки, шрифты, картинки), `api/*` и
   * два route.ts вне `api` (`/kp/download`, `/contracts/[id]/docx`) — там нет
   * разметки, штамп не нужен; `favicon.ico` и `prototypes/*` — содержимое
   * `public/`. Без исключений прокси бил бы по каждому ассету каждой страницы.
   * Синтаксис — path-to-regexp Next: одна группа с отрицательным просмотром;
   * что она компилируется и делит адреса как задумано, проверяет
   * `proxy.test.ts` тем же кодом, что и сборка.
   */
  matcher: ["/((?!api/|_next/|favicon\\.ico|prototypes/|kp/download|contracts/[^/]+/docx).*)"],
};
