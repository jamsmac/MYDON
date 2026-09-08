import path from "node:path";
import { config as loadEnv } from "dotenv";
import { TZ } from "@mydon/shared";

// Часовой пояс закрепляем В КОДЕ, до первого обращения к датам.
// Полагаться на окружение нельзя: контейнер по умолчанию стартует с TZ=UTC,
// dotenv уже выставленную переменную не перезаписывает — и весь брифинг 07:30
// вместе с ночными выборками молча уезжал бы на 5 часов.
process.env.TZ = TZ;

// .env лежит в корне монорепо. Секретов в коде нет — только чтение окружения.
loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} не задан. Заполните его в корневом .env монорепо.`);
  }
  return value;
}

export const appConfig = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  /**
   * Внутренний токен доступа к Core. Пусто — guard отклоняет ВСЕ мутации
   * (fail-closed) и Core предупреждает на старте; заполнен — мутации требуют
   * его. Задавать один и тот же токен Core и всем клиентам
   * (панель/бот/агенты) одновременно.
   *
   * ЧТЕНИЯ ОТКРЫТЫ НЕ ВСЕ. Прежняя формулировка «чтения открыты в обоих
   * случаях» устарела дважды: во-первых, шесть контроллеров закрыты токеном и
   * на GET (`docs`, `routines`, `events`, `apps`, `attachments`, `artifacts`)
   * плюс два маршрута `agents` — там читается пересказ работы агентов по
   * делам владельца; во-вторых, при ПУСТОМ токене они отказывают всем, а не
   * пропускают: `assertServiceToken` первым условием проверяет `!expected`.
   * То есть пустой SERVICE_TOKEN закрывает эти чтения наглухо — включая
   * панель, которая иначе показала бы владельцу 401 вместо архива.
   */
  get serviceToken(): string {
    return process.env.SERVICE_TOKEN ?? "";
  },
  /**
   * Used only for explicit owner confirmation of a potentially repeated charge.
   * Never shared with Bot/Agents/CC and always fail-closed when empty.
   */
  get ownerActionToken(): string {
    return process.env.OWNER_ACTION_TOKEN ?? "";
  },
  /**
   * Аварийный env kill-switch ужесточения owner-identity (P5, R-P5-6).
   *
   * Значение "0" ВСЕГДА выключает ужесточение — даже если тумблер
   * OWNER_IDENTITY_ENFORCED в базе стоит "1", — чтобы ошибка настройки не
   * заперла владельца снаружи собственной панели. Пусто — решают база/дефолт
   * (по умолчанию ужесточение выключено, и мерж среза не меняет поведение).
   */
  get ownerIdentityEnforcedEnv(): string {
    return process.env.OWNER_IDENTITY_ENFORCED?.trim() ?? "";
  },
  /**
   * Final server-side limit for agent.action events per Tashkent day.
   * Zero explicitly disables the cap. Empty or invalid input must not
   * accidentally remove the production limit, so the documented default is 50.
   */
  get agentDailyActionCap(): number {
    const raw = process.env.AGENT_DAILY_ACTION_CAP?.trim();
    if (raw === "0") return 0;
    if (!raw) return 50;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 50;
  },
  /** Фактический пояс процесса — сообщаем то, что есть, а не то, что хотелось бы. */
  get tz(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  },
  /** Путь на том же файловом слое, нехватка места на котором должна портить health. */
  get healthStoragePath(): string {
    return process.env.HEALTH_STORAGE_PATH?.trim() || "/";
  },
  /** Ниже этого остатка запись БД/вложений и Docker-сборки уже ненадёжна. */
  get healthMinStorageMb(): number {
    const parsed = Number(process.env.HEALTH_MIN_STORAGE_MB ?? "1024");
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1024;
  },
};
