"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runSkill } from "../app/skills/actions";

/**
 * «Запустить» в карточке агента (волна A2, R-A2-5).
 *
 * Действие — ТО ЖЕ, что у витрины навыков (`app/skills/actions.ts`): второго
 * пути запуска в системе нет, иначе одно и то же нажатие ставило бы задачи
 * по-разному. Без поля ввода: у Core «не задано» значит «как в навыке», а
 * длинный вход владелец задаёт на витрине, где для него есть место.
 *
 * `disabledReason` — не украшение: запускается только закреплённый навык
 * работающего агента, и честнее не дать нажать с объяснением, чем показать
 * отказ Core после нажатия.
 */
export function RunSkillButton({
  agent,
  skill,
  disabledReason,
}: {
  agent: string;
  skill: string;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  function run() {
    start(async () => {
      // Пустая форма = «как в навыке»: действие само не шлёт пустых полей,
      // чтобы они не затёрли настройку навыка в Core.
      const res = await runSkill(agent, skill, new FormData());
      if (res.ok) {
        setError(null);
        setTaskId(res.taskId ?? null);
        router.refresh();
      } else {
        setTaskId(null);
        setError(res.error ?? "Не получилось запустить");
      }
    });
  }

  return (
    <span className="run-skill">
      <button
        type="button"
        className="btn sm"
        onClick={run}
        disabled={pending || disabledReason !== undefined}
        {...(disabledReason !== undefined ? { title: disabledReason } : {})}
      >
        Запустить
      </button>
      {error && <span className="warn-text">{error}</span>}
      {taskId && <Link href={`/tasks/${taskId}`}>задача поставлена</Link>}
    </span>
  );
}
