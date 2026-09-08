"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DOMAIN_LABELS, DOMAINS } from "@mydon/shared";
import { quickAddTask } from "../app/tasks/actions";
import type { Person } from "../lib/core";
import { CARD_WORD, type CardStatus } from "../lib/state";

/**
 * Быстрая постановка задачи одной строкой.
 *
 * Минимум полей: что сделать, направление, кому, к какому сроку. Срок пишется словами
 * («завтра», «пн», «через 3 дня») — владелец не должен воевать с календарём.
 * Всё остальное настраивается потом в карточке: длинная форма на входе
 * отбивает желание пользоваться системой вообще.
 */
export function QuickAdd({
  people,
  agents,
}: {
  people: Person[];
  /**
   * Статус карточки — СОЮЗОМ, а не голым `string`: подпись берётся из общего
   * словаря (`CARD_WORD`), и просмотр по строке пропустил бы опечатку молча.
   * Данные и так приходят из `AgentCard` (`app/tasks/page.tsx:54`).
   */
  agents: { name: string; status: CardStatus }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  function onSubmit(form: FormData) {
    if (urgent) form.set("priority", "urgent");
    start(async () => {
      const res = await quickAddTask(form);
      if (res.ok) {
        setError(null);
        setUrgent(false);
        (document.getElementById("qa-title") as HTMLInputElement | null)?.form?.reset();
        router.refresh();
      } else {
        setError(res.error ?? "Не удалось создать");
      }
    });
  }

  return (
    <form
      className="quickadd"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      <input
        id="qa-title"
        name="title"
        className="qa-title"
        placeholder="Что нужно сделать?"
        autoComplete="off"
      />

      <div className="qa-row">
        <select
          name="domain"
          className="qa-domain"
          defaultValue=""
          required
          aria-label="Направление"
        >
          <option value="" disabled>
            Направление
          </option>
          {DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {DOMAIN_LABELS[domain]}
            </option>
          ))}
        </select>

        <select name="owner" className="qa-owner" defaultValue="" aria-label="Исполнитель">
          <option value="" disabled>
            Кому поручить
          </option>
          {people.length > 0 && (
            <optgroup label="Люди">
              {people.map((p) => (
                <option key={p.id} value={`human:${p.id}`}>
                  {p.name}
                  {p.role ? ` — ${p.role}` : ""}
                </option>
              ))}
            </optgroup>
          )}
          {agents.length > 0 && (
            <optgroup label="Агенты">
              {agents.map((a) => (
                <option key={a.name} value={`agent:${a.name}`}>
                  {a.name}
                  {/* Та же ось, что у пилюли на `/agents`, и то же вранье до
                      среза Д1: `deprecated` назывался здесь «выключен», пока
                      список агентов уже писал «в архиве». Согласованно неверно
                      — плохо, рассогласованно — хуже: два слова про один факт.
                      Скобки и ведущий пробел — форма строки выпадающего
                      списка, а не второе слово. */}
                  {a.status === "active" ? "" : ` (${CARD_WORD[a.status]})`}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <input
          name="due"
          className="qa-due"
          placeholder="Когда? завтра, пн, 25.08"
          autoComplete="off"
        />

        <button
          type="button"
          className={`qa-flag ${urgent ? "on" : ""}`}
          onClick={() => setUrgent((v) => !v)}
          title="Срочно"
        >
          🔥
        </button>

        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "…" : "Поставить"}
        </button>
      </div>

      {error && <div className="err-text">{error}</div>}
      {people.length === 0 && (
        <div className="hint">
          Сотрудников пока нет — добавь их в разделе «Команда», чтобы поручать задачи людям.
        </div>
      )}
    </form>
  );
}
