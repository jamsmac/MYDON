/**
 * Лента прогона: события шины и аудит одной колонкой по времени (волна R).
 *
 * Core отдаёт их РАЗДЕЛЬНО — у записи шины и у записи аудита разная форма, — а
 * вопрос владельца один: «что происходило по порядку». Две параллельные колонки
 * на него не отвечают, сличать времена глазами пришлось бы ему. Источник строки
 * при этом остаётся видимым (`kind`), иначе запись агента и запись человека
 * слились бы в один безымянный поток.
 *
 * Правило слияния живёт ЗДЕСЬ, а не в панели и не в Core: копия этой функции
 * стояла в обоих, и вторая (`mergeContextless`) уже никем не вызывалась —
 * ровно так расходятся правила, которые владелец считает одним.
 */
export interface TimelineEvent {
  at: string;
  type: string;
  payload: unknown;
}
export interface TimelineAudit {
  at: string;
  action: string;
  actorRef: string | null;
  target: string | null;
}
export interface TimelineRow {
  at: string;
  kind: "event" | "audit";
  title: string;
  detail?: unknown;
}

export function mergeRunTimeline(events: TimelineEvent[], audit: TimelineAudit[]): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...events.map((e) => ({ at: e.at, kind: "event" as const, title: e.type, detail: e.payload })),
    ...audit.map((a) => ({
      at: a.at,
      kind: "audit" as const,
      title: `${a.action}${a.actorRef ? ` · ${a.actorRef}` : ""}`,
      // Цели нет — нет и детали: пустой `<code>` в ленте читается как «деталь
      // была, но потерялась».
      ...(a.target ? { detail: a.target } : {}),
    })),
  ];
  // ISO-строки Core одного формата и одной зоны, поэтому лексикографическое
  // сравнение — это сравнение по времени, без разбора дат.
  return rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
