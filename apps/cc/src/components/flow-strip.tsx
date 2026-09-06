import Link from "next/link";
import type { FlowPhase } from "../lib/core";
import { hhmm } from "../lib/crons";
import { PHASE_LABELS, phaseTone } from "../lib/flows";

/**
 * Полоса прогона: шесть фаз от повода до доставки (волна R, R-R-5).
 *
 * Фазы рисуем ВСЕ и всегда в одном порядке, даже когда фазы «не было»:
 * исчезнувшая клетка читается как «всё прошло», а `skip` — это ответ («у T0
 * согласования не бывает»). Владелец скользит взглядом слева направо и видит,
 * ГДЕ оборвалось, не читая ленту.
 *
 * Состояние несёт не только цвет: подпись фазы, время и заголовок Core говорят
 * то же самое словами — на монохромном экране полоса не перестаёт работать.
 */
export function FlowStrip({ phases }: { phases: FlowPhase[] }) {
  return (
    // `role="list"` не для красоты: у полосы снят маркер (`list-style: none`),
    // а вместе с ним Safari снимает и семантику списка — полоса перестала бы
    // объявляться как «шесть фаз».
    <ol className="flight" role="list" aria-label="Фазы прогона">
      {phases.map((phase) => (
        <li key={phase.name} className={`ph ${phase.state}`} data-state={phase.state}>
          <div className={`pn led run-led ${phaseTone(phase.state)}`}>{PHASE_LABELS[phase.name]}</div>
          {/* Прочерк вместо пустоты: «времени нет» — это про фазу, которой не
              было, а пустая клетка читается как «данные не доехали». */}
          <div className="pt">{phase.at ? hhmm(phase.at) : "—"}</div>
          <div className="tt">
            {phase.href ? <Link href={phase.href}>{phase.title}</Link> : phase.title}
          </div>
          {phase.note && <div className="note">{phase.note}</div>}
        </li>
      ))}
    </ol>
  );
}
