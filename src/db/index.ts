import { randomUUID } from "crypto";
import { getTableColumns, getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __documindInMemoryStores?: Map<string, Record<string, unknown>[]>;
};
const tableStores = globalForDb.__documindInMemoryStores ?? new Map<string, Record<string, unknown>[]>();
globalForDb.__documindInMemoryStores = tableStores;

const getTableRows = (table: unknown) => {
  const tableName = getTableName(table as never);
  if (!tableStores.has(tableName)) tableStores.set(tableName, []);
  return tableStores.get(tableName)!;
};

function getColumnKey(table: unknown, column: { name?: string }) {
  const columns = getTableColumns(table as never) as Record<string, { name: string }>;
  return Object.entries(columns).find(([, value]) => value === column)?.[0]
    ?? Object.entries(columns).find(([, value]) => value.name === column.name)?.[0];
}

function getSqlParts(expression: unknown) {
  if (!expression || typeof expression !== "object" || !("queryChunks" in expression)) return null;
  return (expression as { queryChunks: unknown[] }).queryChunks;
}

function getSqlText(chunks: unknown[] | null) {
  return chunks?.flatMap((chunk) => {
    if (!chunk || typeof chunk !== "object" || !("value" in chunk)) return [];
    const value = (chunk as { value: unknown }).value;
    return Array.isArray(value) ? [value.join("")] : [];
  }).join("") ?? "";
}

const applyWhere = (table: unknown, rows: Record<string, unknown>[], predicate?: unknown) => {
  if (!predicate) return rows;
  if (typeof predicate === "function") return rows.filter(predicate as (row: Record<string, unknown>) => boolean);

  const chunks = getSqlParts(predicate);
  const column = chunks?.find((chunk) => chunk && typeof chunk === "object" && "table" in chunk && "name" in chunk) as
    | { name: string }
    | undefined;
  const parameter = chunks?.find((chunk) => chunk && typeof chunk === "object" && chunk.constructor?.name === "Param") as
    | { value: unknown }
    | undefined;
  const operator = getSqlText(chunks).trim();
  const key = column && getColumnKey(table, column);

  if (!key || !parameter || !operator) {
    throw new TypeError("The in-memory database does not support this filter.");
  }

  return rows.filter((row) => {
    const value = row[key];
    switch (operator) {
      case "=": return value === parameter.value;
      case "<>":
      case "!=": return value !== parameter.value;
      case ">": return (value as never) > (parameter.value as never);
      case ">=": return (value as never) >= (parameter.value as never);
      case "<": return (value as never) < (parameter.value as never);
      case "<=": return (value as never) <= (parameter.value as never);
      default: throw new TypeError(`The in-memory database does not support the "${operator}" filter.`);
    }
  });
};

const applyOrder = (table: unknown, rows: Record<string, unknown>[], orderFns: unknown[]) => {
  if (!orderFns.length) return rows;
  const sorted = [...rows];
  const orders = orderFns.map((order) => {
    const chunks = getSqlParts(order);
    const column = chunks?.find((chunk) => chunk && typeof chunk === "object" && "table" in chunk && "name" in chunk) as
      | { name: string }
      | undefined
      ?? (order && typeof order === "object" && "table" in order && "name" in order
        ? order as { name: string }
        : undefined);
    const key = column && getColumnKey(table, column);
    const direction = getSqlText(chunks).toLowerCase().includes("desc")
      ? -1
      : 1;

    if (!key) throw new TypeError("The in-memory database does not support this ordering.");
    return { key, direction };
  });

  sorted.sort((a, b) => {
    for (const { key, direction } of orders) {
      const left = a[key];
      const right = b[key];
      if (left === right) continue;
      if (left == null) return -direction;
      if (right == null) return direction;
      if ((left as never) < (right as never)) return -direction;
      if ((left as never) > (right as never)) return direction;
    }
    return 0;
  });
  return sorted;
};

export const createInMemoryDb = () => {
  const select = () => ({
    from: (table: any) => {
      let predicate: unknown;
      let orderFns: unknown[] = [];
      let rowLimit: number | undefined;
      const builder: any = {
        where(nextPredicate?: (row: any) => boolean) {
          predicate = nextPredicate;
          return builder;
        },
        orderBy(...nextOrderFns: any[]) {
          orderFns = nextOrderFns;
          return builder;
        },
        limit(limit: number) {
          rowLimit = limit;
          return builder;
        },
        then(resolve: (value: any[]) => unknown, reject?: (reason: unknown) => unknown) {
          try {
            let result = applyWhere(table, getTableRows(table), predicate);
            result = applyOrder(table, result, orderFns);
            if (rowLimit !== undefined) result = result.slice(0, rowLimit);
            return Promise.resolve(result).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      return builder;
    },
  });

  return {
    select,
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async (predicate?: unknown) => {
          const matches = applyWhere(table, getTableRows(table), predicate);
          for (const row of matches) Object.assign(row, values);
          return matches;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (input: Record<string, any> | Record<string, any>[]) => {
        let insertedRows: Record<string, unknown>[] | undefined;
        const execute = async () => {
          if (insertedRows) return insertedRows;
          const rows = Array.isArray(input) ? input : [input];
          const prepared = rows.map((row) => ({
            ...row,
            id: row.id ?? randomUUID(),
            createdAt: row.createdAt ?? new Date(),
            updatedAt: row.updatedAt ?? new Date(),
          }));
          const tableRows = getTableRows(table);
          tableRows.push(...prepared);
          insertedRows = prepared;
          return insertedRows;
        };
        return {
          returning: execute,
          then(resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) {
            return execute().then(resolve, reject);
          },
        };
      },
    }),
    delete: (table: any) => ({
      where: (predicate?: unknown) => {
        let deletedRows: Record<string, unknown>[] | undefined;
        const execute = async () => {
          if (deletedRows) return deletedRows;
          const tableName = getTableName(table);
          const tableRows = getTableRows(table);
          const matches = applyWhere(table, tableRows, predicate);
          const deleted = new Set(matches);
          tableStores.set(tableName, tableRows.filter((row) => !deleted.has(row)));

          if (tableName === "documents") {
            const deletedIds = new Set(matches.map((row) => row.id));
            const relatedConversations = tableStores.get("conversations") ?? [];
            const deletedConversationIds = new Set(
              relatedConversations
                .filter((row) => deletedIds.has(row.documentId))
                .map((row) => row.id),
            );
            tableStores.set("chunks", (tableStores.get("chunks") ?? []).filter((row) => !deletedIds.has(row.documentId)));
            tableStores.set("conversations", relatedConversations.filter((row) => !deletedIds.has(row.documentId)));
            tableStores.set(
              "messages",
              (tableStores.get("messages") ?? []).filter((row) => !deletedConversationIds.has(row.conversationId)),
            );
          } else if (tableName === "conversations") {
            const deletedIds = new Set(matches.map((row) => row.id));
            tableStores.set("messages", (tableStores.get("messages") ?? []).filter((row) => !deletedIds.has(row.conversationId)));
          }

          deletedRows = matches;
          return deletedRows;
        };
        return {
          returning: execute,
          then(resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) {
            return execute().then(resolve, reject);
          },
        };
      },
    }),
    execute: async (query?: any) => {
      if (query && typeof query.toString === "function" && query.toString().includes("SELECT 1")) {
        return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    },
  } as any;
};

if (!databaseUrl) {
  console.warn("DATABASE_URL is not set; running in local demo mode with in-memory storage.");
}

export const pool = databaseUrl
  ? (globalForDb.__arenaNextJsPostgresqlPool ?? new Pool({ connectionString: databaseUrl }))
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = databaseUrl ? drizzle(pool as Pool) : createInMemoryDb();
export const isDatabaseAvailable = Boolean(databaseUrl);
