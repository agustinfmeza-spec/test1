export interface ListQuery {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
}

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

/** Parsea page/pageSize/search/sortBy/sortDir de la query string de un listado, para alimentar las grillas del frontend. */
export function parseListQuery(url: URL): ListQuery {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  );
  const search = url.searchParams.get("search")?.trim() || undefined;
  const sortBy = url.searchParams.get("sortBy") ?? undefined;
  const sortDir = url.searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, search, sortBy, sortDir };
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(data: T[], total: number, query: ListQuery): Paginated<T> {
  return {
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
