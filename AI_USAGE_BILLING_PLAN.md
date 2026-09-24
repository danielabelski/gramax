# План биллинга AI-агента для Enterprise Cloud

## 1. Цель

Добавить тарификацию каждого запроса AI-агента в Enterprise Cloud за счёт внутреннего AI-баланса подписки.

Тарификация должна:

- разрешать использование агента только пользователю с доступом `full` в текущей организации;
- запрещать запуск нового запроса при AI-балансе `<= 0`;
- получать фактический usage из последнего SSE-чанка upstream-ответа;
- рассчитывать стоимость по количеству uncached input, cached input и output токенов;
- атомарно уменьшать `subscriptions.ai_wallet` и сохранять аудит списания;
- не менять поведение обычного Enterprise-таргета.

## 2. Утверждённые правила

### Доступ

- Сначала выполняется существующий `CheckUserAccessOrganizationUseCase`.
- После него отдельный Enterprise Cloud guard проверяет:
  - membership пользователя в текущей организации;
  - `membership_access_statuses.code === "full"`;
  - существование подписки;
  - валюту AI-баланса;
  - текущий AI-баланс.
- Membership со статусом, отличным от `full`, возвращает HTTP `403`.
- Баланс `<= 0` возвращает HTTP `402`.
- AI-wallet поддерживается только в `RUB`. Другая валюта считается ошибкой конфигурации и не позволяет обратиться к upstream.
- Разрешён овердрафт из-за уже запущенных и параллельных запросов. Положительного баланса достаточно для старта запроса, даже если его не хватит на полную стоимость.

### Upstream-запрос

- Для Enterprise Cloud сервер принудительно устанавливает:

  ```json
  {
    "stream": true,
    "stream_options": {
      "include_usage": true
    }
  }
  ```

- Остальные логические данные запроса сохраняются.
- Разрешены только активные модели из справочника тарифов в БД.
- Миграция создаёт пустой справочник; модели и цены настраиваются системными администраторами.
- Неизвестная модель отклоняется до обращения к upstream с HTTP `400`.

### Тариф

Цены задаются в RUB за 1 миллион токенов и читаются из БД. Отдельные категории токенов могут иметь нулевую цену.

Используется формула:

```text
cachedInputTokens = prompt_cache_hit_tokens
  ?? prompt_tokens_details.cached_tokens
  ?? 0
inputTokens = prompt_cache_miss_tokens
  ?? max(prompt_tokens - cachedInputTokens, 0)
outputTokens = completion_tokens

rawAmount =
  inputTokens * 120 / 1_000_000
  + cachedInputTokens * 2 / 1_000_000
  + outputTokens * 340 / 1_000_000
```

- `prompt_tokens` и `total_tokens` не прибавляются к стоимости повторно.
- Они используются для валидации и аудита usage.
- Расчёт не должен накапливать ошибки floating point.
- Итог округляется до копеек.
- Для положительного usage минимальное списание составляет `0.01 RUB`.
- При полностью нулевом usage списание не выполняется.

### Отсутствующий usage и ошибки списания

- Если достоверный usage не получен, деньги не списываются.
- Отсутствующий или некорректный usage логируется.
- При отключении клиента upstream-запрос по-прежнему отменяется.
- Если usage уже был получен до отключения клиента, стоимость списывается.
- Ошибка БД после streaming-ответа логируется, но не заменяет уже отданный клиенту ответ.
- На первом этапе нет фонового retry/outbox для несписанных запросов.

## 3. Разделение финансовых сущностей

`org_balance_ledger` не используется для расходов внутреннего AI-баланса. Он остаётся частью учёта реальных платежей и зачисления купленных средств.

Расходы AI-баланса фиксируются в новой таблице `ai_usage_charges`. Каждая строка этой таблицы означает один успешно тарифицированный AI-запрос и является источником аудита внутреннего списания.

Отдельная таблица `ai_wallet_transactions` на первом этапе не создаётся. Она понадобится, если появятся другие типы внутренних движений: бонусы, ручные корректировки, возвраты стоимости запроса, промокоды, перенос или сгорание баланса.

## 4. Схема AI-тарификации

Добавить новую миграцию, не изменяя уже применённую миграцию `2026-05-30_ges_cloud_billing_tables.ts`.

### `ai_models`

| Поле | Назначение |
| --- | --- |
| `id` | `bigserial`, primary key |
| `code` | уникальный стабильный код модели из `request.body.model` |
| `input_price_per_million` | цена uncached input за миллион токенов |
| `cached_input_price_per_million` | цена cached input за миллион токенов |
| `output_price_per_million` | цена output за миллион токенов |
| `is_active` | доступность модели для новых запросов |
| `created_at` | время создания записи |
| `updated_at` | время последнего изменения |

Справочник создаётся пустым. Валюта в таблице не хранится: все тарифы интерпретируются как RUB. Цены неотрицательны, при этом хотя бы одна категория модели должна иметь положительную цену.

### `ai_usage_charges`

Предлагаемые поля:

| Поле | Назначение |
| --- | --- |
| `id` | `bigserial`, primary key |
| `request_id` | внутренний UUID AI-запроса, unique |
| `upstream_request_id` | request ID от AI-сервера, nullable |
| `subscription_id` | FK на `subscriptions.id` |
| `user_id` | FK на `users.id`, инициатор расхода |
| `requested_model` | модель из нормализованного запроса |
| `input_tokens` | uncached input tokens |
| `cached_input_tokens` | cached input tokens |
| `output_tokens` | completion/output tokens |
| `total_tokens` | значение `total_tokens` для аудита |
| `input_price_per_million` | snapshot тарифа input |
| `cached_input_price_per_million` | snapshot тарифа cached input |
| `output_price_per_million` | snapshot тарифа output |
| `raw_amount` | сумма до округления с повышенной decimal-точностью |
| `charged_amount` | фактически списанная сумма `decimal(19, 2)` |
| `currency` | `char(3)`, в первой версии только `RUB` |
| `balance_before` | AI-баланс перед списанием |
| `balance_after` | AI-баланс после списания |
| `created_at` | время успешного списания |

Ограничения и индексы:

- unique constraint на `request_id`;
- индексы `(subscription_id, created_at)` и `(user_id, created_at)`;
- token-поля неотрицательны;
- цены неотрицательны, а `raw_amount > 0`;
- `charged_amount >= 0.01`;
- `currency = 'RUB'` на первом этапе;
- `balance_after = balance_before - charged_amount`;
- prompts, completions, tool calls и другие пользовательские данные в таблицу не сохраняются.

`organization_id` в `ai_usage_charges` не дублируется. Организация определяется через связанную запись `subscriptions` по `subscription_id`.

В типы Kysely `GesCloudDbEntities.ts` добавить `AiUsageChargesTable` и зарегистрировать таблицу в `GesCloudDatabase`.

Удалить неиспользуемый и более не соответствующий назначению ledger вариант `ai_wallet_spent` из `BalanceLedgerReasonCode`. Существующее фиксирование `ai_wallet_topup` не менять.

## 5. Доменная логика тарификации

### Справочник моделей

`SqlAiModelPriceProvider` читает активный тариф по точному коду модели из `ai_models`. Отсутствующая или неактивная модель считается неподдерживаемой. Провайдер добавляет валюту `RUB` на уровне кода.

### Нормализация usage и калькулятор

`OpenAiUsageNormalizer`:

- принимает сырой OpenAI-compatible usage;
- проверяет, что token-поля являются конечными неотрицательными целыми числами;
- вычисляет cached, uncached input и output tokens;
- использует `prompt_cache_hit_tokens`, а при его отсутствии — `prompt_tokens_details.cached_tokens`;
- применяет fallback для отсутствующего `prompt_cache_miss_tokens`;
- не проверяет математическую согласованность `prompt_tokens`, cache hit/miss и `total_tokens` между собой;
- возвращает `NormalizedAiTokenUsage` либо отдельный результат для некорректного usage.

Чистый `AiUsagePriceCalculator` принимает модель и `NormalizedAiTokenUsage`, применяет тарифы и возвращает token breakdown, snapshot тарифов, raw amount и rounded charged amount. Калькулятор возвращает отдельный результат для неизвестной модели и нулевого usage, но не знает формат upstream-ответа.

## 6. Репозитории и транзакционное списание

### `AiUsageChargeRepository`

Создать интерфейс и SQL-реализацию для вставки записи `ai_usage_charges` внутри переданной `DbTransaction`.

Repository не рассчитывает цену и не принимает HTTP-решения. Его обязанности ограничены persistence и проверкой уникальности `request_id`.

### Изменения `SubscriptionRepository`

Добавить операции:

- получить данные AI-wallet для предварительной проверки;
- получить и заблокировать подписку по organization ID внутри транзакции;
- атомарно уменьшить AI-баланс на `charged_amount` и вернуть `balance_after`.

Для финального списания строка подписки блокируется через `FOR UPDATE`. Долгая транзакция на время upstream-запроса не открывается.

### `ChargeAiUsageUseCase`

Входные данные:

- внутренний `requestId`;
- `upstreamRequestId`;
- organization ID из существующего Express request context;
- email пользователя из существующего Express request context;
- requested model;
- сырой OpenAI-compatible usage.

В качестве внутреннего `requestId` используется UUID текущего HTTP-запроса из `getRequestContext()`. `GesCloudOpenAiChatCompletionsExtension` не зависит от репозиториев и передаёт в use case только organization ID и email пользователя. `ChargeAiUsageUseCase` сам повторно получает user ID через `UserRepository`, а subscription ID — через `SubscriptionRepository`. Эти данные не сохраняются в промежуточном billing context.

Последовательность:

1. Нормализовать сырой usage через `OpenAiUsageNormalizer`.
2. Рассчитать стоимость через `AiUsagePriceCalculator`.
3. Повторно получить user ID по email и subscription ID по organization ID.
4. Открыть короткую DB-транзакцию.
5. Заблокировать подписку через `FOR UPDATE`.
6. Повторно проверить currency `RUB`.
7. Получить `balanceBefore` без запрета овердрафта.
8. Атомарно уменьшить `subscriptions.ai_wallet` на `chargedAmount` и получить `balanceAfter`.
9. Вставить `ai_usage_charges` со всеми token, tariff и balance snapshot-полями.
10. Commit.
11. При любой ошибке rollback обеих операций.

Уникальный `request_id` защищает от двойного списания. Повторная обработка того же request ID не должна уменьшать баланс повторно.

## 7. Guard доступа к AI

### Данные membership

Расширить `UserOrganizationRepository` методом, который по email пользователя и organization ID возвращает:

```ts
{
  accessStatus,
}
```

Запрос должен читать `users_organizations`, `users` и `membership_access_statuses`.

### `AiAgentAccessGuard`

Создать отдельный Enterprise Cloud service/guard после `OrganizationDependentService`.

Guard не зависит от Express и HTTP. Он принимает email пользователя и organization ID.

Guard:

1. Получает membership пользователя.
2. При отсутствии `full` возвращает `AccessRestricted`.
3. Читает AI-wallet подписки.
4. При отсутствии подписки возвращает `SubscriptionNotFound`.
5. При currency, отличной от `RUB`, возвращает `UnsupportedCurrency`.
6. При `balance <= 0` возвращает `BalanceEmpty`.
7. При успехе разрешает доступ без возврата billing-данных.

### `AiAgentAccessGuardService`

Отдельный service связывает guard с HTTP:

1. Берёт пользователя из доверенного `req.userContext` и организацию из `req.organizationContext`.
2. Передаёт email и organization ID в `AiAgentAccessGuard`.
3. Преобразует `AccessRestricted` в:

   ```http
   HTTP 403
   ```

   ```json
   {
     "error": {
       "code": "ai_access_restricted",
       "message": "AI agent is unavailable for restricted organization members"
     }
   }
   ```

4. Преобразует `BalanceEmpty` в:

   ```http
   HTTP 402
   ```

   ```json
   {
     "error": {
       "code": "ai_balance_empty",
       "message": "AI balance is empty"
     }
   }
   ```

5. Преобразует `UnsupportedCurrency`, `SubscriptionNotFound` и `UnexpectedError` в соответствующие HTTP `500` ответы.
6. При успехе передаёт управление proxy без изменения Express request.

Данные для последующего списания запрашиваются повторно на этапе billing. Guard не создаёт request ID и не сохраняет user, organization или subscription ID в промежуточном контексте.

Предварительная проверка не удерживает DB-lock и не гарантирует отсутствие овердрафта. Это принятое поведение.

## 8. Расширение core OpenAI proxy

`OpenAiChatCompletions` остаётся общим транспортным сервисом и не импортирует Enterprise Cloud repositories/use cases.

Добавить необязательный интерфейс расширения proxy, который позволит конкретному таргету:

- нормализовать и валидировать request body перед fetch;
- получить последний валидный usage после streaming;
- обработать отсутствие usage;
- получить requested model и upstream request ID.

Без переданного расширения сервис должен работать идентично текущему Enterprise-варианту.

### Нормализация Enterprise Cloud body

Enterprise Cloud-реализация расширения:

- требует JSON object body;
- требует непустой строковый `model`;
- возвращает HTTP `400 ai_request_invalid` для некорректного body или model;
- валидирует model через `AiModelPriceProvider` и возвращает HTTP `400 ai_model_not_supported` для неизвестной модели;
- принудительно выставляет `stream: true`;
- принудительно выставляет `stream_options.include_usage: true`;
- сохраняет остальные поля body.

### Сбор usage из SSE

Core proxy должен продолжать передавать downstream исходные байты без изменения, одновременно передавая их внутреннему incremental SSE parser.

Parser должен корректно работать при:

- разрыве одного SSE event между несколькими transport chunks;
- нескольких SSE events в одном transport chunk;
- `\n\n` и `\r\n\r\n`;
- `[DONE]`;
- невалидном JSON event;
- usage-чанке без `choices`;
- отсутствии `[DONE]` после уже полученного usage.

Сохраняется последний структурно корректный JSON object `usage`. Математическая и доменная валидация token-полей выполняется в `OpenAiUsageNormalizer`. Usage передаётся Enterprise Cloud billing handler ровно один раз.

Upstream request ID берётся из поля `id` SSE event, а при его отсутствии — из заголовка `x-request-id` upstream-ответа.

Если usage уже получен, последующее отключение клиента не отменяет списание. Если usage не получен, handler только логирует событие.

## 9. Wiring Enterprise Cloud

В `GesCloudApplication` создать и зарегистрировать:

- `AiUsageChargeRepository`;
- SQL price provider;
- `OpenAiUsageNormalizer`;
- `AiUsagePriceCalculator`;
- `ChargeAiUsageUseCase`;
- `GesCloudOpenAiChatCompletionsExtension` с billing handler;
- `AiAgentAccessGuard`.

`AiAgentAccessGuardService` создаётся отдельно для каждой закэшированной organization-specific service chain. Общий singleton service не используется, поскольку `ServiceFinder` мутирует поле `_next` при связывании цепочки.

В `createApiMiddleware.ts` итоговая цепочка должна быть:

```text
OrganizationDependentService(CheckUserAccessOrganizationUseCase)
→ AiAgentAccessGuardService
→ OpenAiChatCompletions(envProxy, GesCloudOpenAiChatCompletionsExtension)
```

Обычный Enterprise продолжает создавать `OpenAiChatCompletions` без billing extension.

## 10. Логирование

Обязательные события:

- `aiUsageChargeSkipped` для нулевого usage и идемпотентного повтора;
- `aiUsageChargeRejected` для неизвестной модели, некорректного usage, отсутствующего пользователя или подписки и неподдерживаемой валюты;
- `aiUsageChargeFailed` для неожиданной ошибки расчёта или списания;
- `aiUsageChargeRollbackFailed` для ошибки отката транзакции;
- `aiUsageMissing` для успешного upstream-ответа без usage;
- `aiUsageBillingPreparationFailed` для отсутствующих request contexts или requested model.

Контекст логов должен содержать только технические и billing-данные:

- request ID;
- upstream request ID, если есть;
- organization, subscription и user ID;
- model;
- исходный usage в безопасно сериализованном строковом виде;
- token counts, если они валидны;
- рассчитанную стоимость, если она была рассчитана;
- техническую причину ошибки.

Запрещено логировать prompts, completions, tool calls, cookies, AI token и другие секреты.

Новые сообщения необходимо:

- зарегистрировать в `services/core/Logic/Loggers/LogContexts/GesCloudLogContext.ts`;
- добавить в `MESSAGE_TO_EVENT_ID` файла `services/core/Logic/Loggers/LogFormatters/CefLogFormatter.ts`;
- назначить уникальные event ID из секции GES Cloud `9xxx`.

Успешное списание отдельно логировать не требуется: источником аудита является `ai_usage_charges`.

## 11. Ошибки API

| Условие | HTTP | Код |
| --- | ---: | --- |
| Пользователь не имеет доступа к организации | существующее поведение | существующее сообщение |
| Membership не `full` | 403 | `ai_access_restricted` |
| AI-баланс `<= 0` | 402 | `ai_balance_empty` |
| Неизвестная модель | 400 | `ai_model_not_supported` |
| Валюта wallet не `RUB` | 500 | `ai_wallet_currency_unsupported` |
| Подписка не найдена | 500 | `ai_subscription_not_found` |
| Неожиданная ошибка проверки доступа | 500 | `ai_access_check_failed` |
| AI не настроен | 503 | `ai_not_configured` |
| Upstream недоступен | 502 | `ai_proxy_failed` |

Ошибки возвращаются в форме:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable message"
  }
}
```

## 12. Тестовое покрытие

Согласно правилам проекта backend-тесты, сборка и линтер не запускаются агентом. Тесты следует написать, но их запуск выполняет пользователь.

### Unit-тесты нормализатора и калькулятора

- uncached input;
- cached input;
- output;
- смешанный usage;
- fallback через `prompt_tokens - prompt_cache_hit_tokens`;
- fallback через `prompt_tokens_details.cached_tokens`;
- приоритет верхнеуровневого `prompt_cache_hit_tokens` над вложенным значением;
- отсутствие двойного учёта prompt tokens;
- округление до копеек;
- minimum charge `0.01`;
- полностью нулевой usage;
- отрицательные, дробные, `NaN` и отсутствующие token values;
- неизвестная модель.

### DB-тесты guard

- membership `full` и положительный RUB-баланс;
- membership `restricted` → `AccessRestricted`;
- отсутствующий membership;
- отсутствующая подписка → `SubscriptionNotFound`;
- нулевой баланс → `BalanceEmpty`;
- отрицательный баланс → `BalanceEmpty`;
- небольшой положительный баланс допускает запрос;
- валюта не RUB;
- успешная проверка возвращает только разрешение доступа без billing-данных.

### DB-тесты списания

- баланс уменьшается на рассчитанную сумму;
- `ai_usage_charges` содержит user/model/usage/tariff/balance snapshots;
- баланс может стать отрицательным;
- update и insert выполняются атомарно;
- ошибка вставки откатывает изменение баланса;
- одинаковый `request_id` не списывает деньги дважды;
- параллельные списания не теряют update друг друга;
- отсутствующий пользователь не создаёт списание;
- отсутствующая подписка не создаёт списание;
- currency повторно проверяется под lock.

### Unit-тесты OpenAI proxy

- обычный Enterprise без extension сохраняет прежнее поведение;
- Enterprise Cloud body принудительно включает streaming usage;
- неизвестная модель не уходит в upstream;
- usage event может быть разбит между chunks;
- один chunk может содержать несколько events;
- последний usage передаётся handler ровно один раз;
- исходные SSE-байты остаются неизменными для клиента;
- отсутствие usage вызывает anomaly handler;
- usage, полученный до disconnect, тарифицируется;
- disconnect до usage не тарифицируется;
- upstream error не создаёт charge.

## 13. Этапы реализации

Работу выполнять последовательно, не смешивая этапы без отдельного запроса пользователя.

1. **DB schema и repository contracts**
   - миграция `ai_models` и `ai_usage_charges`;
   - Kysely types;
   - `AiUsageChargeRepository`;
   - методы membership и subscription repositories.

2. **Pricing и charge use case**
   - SQL tariff provider;
   - калькулятор;
   - транзакционное списание;
   - unit и DB-тесты этих компонентов.

3. **Enterprise Cloud access guard**
   - проверка membership, currency и balance;
   - HTTP 403/402/500;
   - DB-тесты guard.

4. **Core proxy extension и SSE usage collector**
   - target-neutral extension interface;
   - нормализация body;
   - прозрачный SSE parser;
   - callbacks usage/missing usage;
   - тесты proxy.

5. **Enterprise Cloud integration**
   - billing handler;
   - wiring в `GesCloudApplication`;
   - новая цепочка в `createApiMiddleware.ts`;
   - GesCloud log contexts, CEF event IDs и anomaly/error logs;
   - проверка отсутствия изменений для обычного Enterprise.

6. **Финальное тестовое покрытие**
   - оставшиеся тестовые сценарии.

## 14. Вне текущего объёма

- UI управления тарифами;
- reservation максимальной стоимости запроса;
- запрет овердрафта для параллельных запросов;
- retry/outbox для несписанного usage;
- тарификация запроса без фактического usage;
- единый `ai_wallet_transactions` ledger;
- бонусы, возвраты и ручные корректировки AI-баланса;
- изменение UI обработки 403;
- хранение prompt или completion данных.
