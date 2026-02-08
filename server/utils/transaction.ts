/**
 * Database transaction utilities
 *
 * Provides:
 * - Transaction wrapper for multi-step operations
 * - Automatic rollback on error
 * - Connection management
 */

import { getPool } from "./dbPool";
import type { PoolConnection } from "mysql2/promise";

/**
 * Execute a function within a database transaction
 *
 * @param operation - Async function to execute within transaction
 * @returns Result of the operation
 *
 * @example
 * const result = await withTransaction(async (conn) => {
 *   await conn.execute('INSERT INTO users ...');
 *   await conn.execute('INSERT INTO profiles ...');
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  operation: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  if (!pool) {
    throw new Error("[Transaction] Database pool not available");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await operation(connection);

    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Execute a function with a connection (no transaction)
 * Useful for read-only operations that need connection pooling
 */
export async function withConnection<T>(
  operation: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  if (!pool) {
    throw new Error("[Connection] Database pool not available");
  }

  const connection = await pool.getConnection();

  try {
    return await operation(connection);
  } finally {
    connection.release();
  }
}

/**
 * Execute multiple SQL statements in a transaction
 * Simpler interface for sequential statements
 */
export async function executeInTransaction(
  statements: Array<{ sql: string; values?: unknown[] }>
): Promise<void> {
  await withTransaction(async (connection) => {
    for (const { sql, values } of statements) {
      await connection.execute(sql, values);
    }
  });
}

/**
 * Transaction-aware batch insert
 * Inserts multiple rows within a single transaction
 */
export async function batchInsert(
  tableName: string,
  columns: string[],
  rows: unknown[][]
): Promise<number[]> {
  if (rows.length === 0) return [];

  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

  const insertIds: number[] = [];

  await withTransaction(async (connection) => {
    for (const row of rows) {
      const [result] = await connection.execute(sql, row);
      insertIds.push((result as any).insertId);
    }
  });

  return insertIds;
}

/**
 * Transaction-aware batch update
 * Updates multiple rows within a single transaction
 */
export async function batchUpdate(
  updates: Array<{
    table: string;
    set: Record<string, unknown>;
    where: Record<string, unknown>;
  }>
): Promise<number> {
  if (updates.length === 0) return 0;

  let totalAffected = 0;

  await withTransaction(async (connection) => {
    for (const { table, set, where } of updates) {
      const setClause = Object.keys(set)
        .map((key) => `${key} = ?`)
        .join(", ");
      const whereClause = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(" AND ");

      const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
      const values = [...Object.values(set), ...Object.values(where)];

      const [result] = await connection.execute(sql, values);
      totalAffected += (result as any).affectedRows;
    }
  });

  return totalAffected;
}

/**
 * Check if currently inside a transaction
 * Note: This is a best-effort check based on connection state
 */
export async function isInTransaction(connection: PoolConnection): Promise<boolean> {
  try {
    const [rows] = await connection.query("SELECT @@autocommit as autocommit");
    return (rows as any)[0]?.autocommit === 0;
  } catch {
    return false;
  }
}

/**
 * Savepoint utilities for nested transaction-like behavior
 */
export async function setSavepoint(
  connection: PoolConnection,
  name: string
): Promise<void> {
  await connection.query(`SAVEPOINT ${name}`);
}

export async function rollbackToSavepoint(
  connection: PoolConnection,
  name: string
): Promise<void> {
  await connection.query(`ROLLBACK TO SAVEPOINT ${name}`);
}

export async function releaseSavepoint(
  connection: PoolConnection,
  name: string
): Promise<void> {
  await connection.query(`RELEASE SAVEPOINT ${name}`);
}
