const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    if (typeof data === "object" && data && "message" in data) {
      const msg = (data as { message: string | string[] }).message;
      detail = Array.isArray(msg) ? msg.join("; ") : String(msg);
    }
    throw new ApiError(detail, res.status, data);
  }

  return data as T;
}
