// Admin DB client — /api/admin/db proxy-гаар дамжуулж service_role ашиглана.
// Admin page-ууд supabase.from() биш энийг ашиглана.

interface QueryParams {
  select?: string;
  eq?: Record<string, any>;
  in?: Record<string, any[]>;
  not?: Record<string, any>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
  count?: boolean;
  data?: any;
}

interface QueryResult {
  data: any;
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
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

// supabase.from() шиг interface
export function adminFrom(table: string) {
  return {
    select: (columns?: string) => new AdminQueryBuilder(table, 'select', { select: columns }),
    insert: (data: any) => adminQuery(table, 'insert', { data }),
    update: (data: any) => new AdminUpdateBuilder(table, data),
    delete: () => new AdminDeleteBuilder(table),
  };
}

class AdminQueryBuilder {
  private table: string;
  private params: QueryParams;

  constructor(table: string, action: string, params: QueryParams = {}) {
    this.table = table;
    this.params = params;
  }

  eq(column: string, value: any) {
    this.params.eq = { ...this.params.eq, [column]: value };
    return this;
  }

  in(column: string, values: any[]) {
    this.params.in = { ...this.params.in, [column]: values };
    return this;
  }

  not(column: string, operator: string, value: any) {
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

  async then(resolve: (value: QueryResult) => void, reject?: (reason: any) => void) {
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
  private data: any;
  private params: QueryParams = {};

  constructor(table: string, data: any) {
    this.table = table;
    this.data = data;
  }

  eq(column: string, value: any) {
    this.params.eq = { ...this.params.eq, [column]: value };
    return this;
  }

  async then(resolve: (value: QueryResult) => void, reject?: (reason: any) => void) {
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

  eq(column: string, value: any) {
    this.params.eq = { ...this.params.eq, [column]: value };
    return this;
  }

  async then(resolve: (value: QueryResult) => void, reject?: (reason: any) => void) {
    try {
      const result = await adminQuery(this.table, 'delete', this.params);
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
    }
  }
}
