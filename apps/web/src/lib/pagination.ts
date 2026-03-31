/**
 * Shared pagination utilities for API routes.
 *
 * Provides consistent offset-based pagination across all endpoints.
 *
 * Usage in an API route:
 *   import { parsePagination, paginatedResponse } from "@/lib/pagination";
 *
 *   export async function GET(request: Request) {
 *     const { page, pageSize, from, to } = parsePagination(request);
 *     const { data, count } = await supabase
 *       .from("table")
 *       .select("*", { count: "exact" })
 *       .range(from, to);
 *     return NextResponse.json(paginatedResponse(data ?? [], count ?? 0, { page, pageSize }));
 *   }
 */

export type PaginationParams = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * Parse page and pageSize from request URL search params.
 * Returns computed `from` and `to` for Supabase `.range()`.
 */
export function parsePagination(
  request: Request,
  defaults: { pageSize?: number; maxPageSize?: number } = {},
): PaginationParams {
  const { pageSize: defaultPageSize = 25, maxPageSize = 100 } = defaults;
  const url = new URL(request.url);

  const rawPage = parseInt(url.searchParams.get("page") ?? "1", 10);
  const rawPageSize = parseInt(url.searchParams.get("pageSize") ?? String(defaultPageSize), 10);

  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number.isNaN(rawPageSize) ? defaultPageSize : rawPageSize));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

/**
 * Build a standardised paginated response object.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: { page: number; pageSize: number },
) {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
    } satisfies PaginationMeta,
  };
}
