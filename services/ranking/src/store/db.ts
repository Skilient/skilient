import type postgres from "postgres";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | Tx;

/** Numeric columns arrive as strings; null stays null. */
export const num = (v: string | number | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
