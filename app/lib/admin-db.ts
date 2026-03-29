// Admin DB client — /api/admin/db proxy-гаар дамжуулж service_role ашиглана.
// Admin page-ууд supabase.from() биш энийг ашиглана.

type DbValue = string | number | boolean | null;

interface QueryParams {
  select?: string;
  eq?: Record<string, DbValue>;
  in?: Record<string, DbValue[]>;
  not?: Record<string, DbValue>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
  count?: boolean;
  data?: Record<string, unknown> | Record<string, unknown>[];
}

interface QueryResult {
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  error: string | null;
  count?: number;
}

async function adminQuery(table: string, action: string, params?: QueryParams): Promise<QueryResult> {
  try {
    const res = await fetch('/api/admin/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, action, params }),
    });
    const result = await res.json();
    if (!res.ok) {
      return { data: null, error: result.error || 'Request failed' };
    }
    return { data: result.data, error: null, count: result.count };
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// supabase.from() шиг interface
export function adminFrom(table: string) {
  return {
    select: (columns?: string) => new AdminQueryBuilder(table, 'select', { select: columns }),
    insert: (data: Record<string, unknown> | Record<string, unknown>[]) => adminQuery(table, 'insert', { data: data as Record<string, unknown>[] }),
    upsert: (data: Record<string, unknown> | Record<string, unknown>[]) => adminQuery(table, 'upsert', { data: data as Record<string, unknown>[] }),
    update: (data: Record<string, unknown>) => new AdminUpdateBuilder(table, data),
    delete: () => new AdminDeleteBuilder(table),
  };
}

class AdminQueryBuilder {
  private table: string;
  private params: QueryParams;

  constructor(table: string, _action: string, params: QueryParams = {}) {
    this.table = table;
    this.params = params;
  }

  eq(column: string, value: DbValue) {
    this.params.eq = { ...this.params.eq, [column]: value };
    return this;
  }

  in(column: string, values: DbValue[]) {
    this.params.in = { ...this.params.in, [column]: values };
    return this;
  }

  not(column: string, _operator: string, value: DbValue) {
    this.params.not = { ...this.params.not, [column]: value };
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.params.order = { column, ascending: opts?.ascending };
    return this;
  }

  limit(n: number) {
    this.params.limit = n;
    return this;
  }

  single() {
    this.params.single = true;
    return this;
  }

  async then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    try {
      const result = await adminQuery(this.table, 'select', this.params);
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
    }
  }
}

class AdminUpdateBuilder {
  private table: string;
  private data: Record<string, unknown>;
  private params: QueryParams = {};

  constructor(table: string, data: Record<string, unknown>) {
    this.table = table;
    this.data = data;
  }

  eq(column: string, value: DbValue) {
    this.params.eq = { ...this.params.eq, [column]: value };
    return this;
  }

  async then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    try {
      const result = await adminQuery(this.table, 'update', { data: this.data, ...this.params });
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
    }
  }
}

class AdminDeleteBuilder {
  private table: string;
  private params: QueryParams = {};

  constructor(table: string) {
    this.table = table;
  }

  eq(column: string, value: DbValue) {
    this.params.eq = { ...this.params.eq, [column]: value };
    return this;
  }

  async then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    try {
      const result = await adminQuery(this.table, 'delete', this.params);
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
    }
  }
}
