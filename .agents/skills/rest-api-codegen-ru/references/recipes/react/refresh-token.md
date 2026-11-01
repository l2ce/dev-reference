# Обновление токена доступа

Этот пример дополняет [JWT из `localStorage`](./jwt-local-storage.md). После ответа `401` клиент обновляет токен и один раз повторяет исходный запрос.

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { ApiError, createApiClient, HttpClient, operationsTree } from "./generated";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token-storage";

const baseUrl = "https://api.example.com";
let refreshInFlight: Promise<void> | undefined;

async function refreshAccessToken(): Promise<void> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    clearAccessToken();
    throw new Error("Не удалось обновить токен");
  }

  const payload = await response.json() as { accessToken: string };
  setAccessToken(payload.accessToken);
}

function refreshOnce(): Promise<void> {
  return refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = undefined;
  });
}

const httpClient = new HttpClient({
  baseUrl,
  credentials: "include",

  onRequest(request) {
    if (!request.secure) return request;

    const headers = new Headers(request.headers);
    const accessToken = getAccessToken();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return { ...request, headers };
  },

  async onError(error, context) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      !context.request.secure ||
      context.retryCount >= 1
    ) {
      throw error;
    }

    const failedAuthorization = new Headers(context.request.headers)
      .get("Authorization");
    const accessToken = getAccessToken();
    const currentAuthorization = accessToken
      ? `Bearer ${accessToken}`
      : null;

    if (failedAuthorization === currentAuthorization) {
      await refreshOnce();
    }

    return context.retry();
  },
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

```ts
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

`refreshInFlight` объединяет параллельные обновления, а `retryCount` ограничивает повтор одной попыткой. Если refresh завершается ошибкой, токен удаляется и ошибка возвращается приложению.
