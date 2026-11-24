import { randomBytes } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { migrate, readMigrations } from "@skilient/platform/db";

/** The same major version as the Azure server (deploy/modules/data.bicep). */
export const POSTGRES_IMAGE = "postgres:17-alpine";

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  /** Connection as the admin (migration) role. */
  admin: postgres.Sql;
  /** Creates a service's schema and login role, applies its migrations, and connects as that role. */
  service(name: string, migrationsDir: string): Promise<postgres.Sql>;
  stop(): Promise<void>;
}

export function roleOf(service: string): string {
  return `svc_${service.replace(/-/g, "_")}`;
}

export function schemaOf(service: string): string {
  return service.replace(/-/g, "_");
}

/**
 * A throwaway Postgres in a container. Each service gets its own schema and
 * login role, with no access to any other schema: the database roles enforce
 * "no query names another service's schema" (CLAUDE.md, "Never").
 */
export async function startPostgres(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const admin = postgres(container.getConnectionUri(), { max: 4, onnotice: () => {} });
  await admin`revoke all on schema public from public`;
  const opened: postgres.Sql[] = [admin];
  return {
    container,
    admin,
    async service(name, migrationsDir) {
      const role = roleOf(name);
      const schema = schemaOf(name);
      const password = randomBytes(18).toString("base64url");
      await admin.unsafe(`create role ${role} login password '${password}' noinherit`);
      await admin.unsafe(`create schema ${schema}`);
      await admin.unsafe(`grant usage on schema ${schema} to ${role}`);
      await migrate(admin, schema, readMigrations(migrationsDir));
      const sql = postgres({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        username: role,
        password,
        max: 2,
        onnotice: () => {},
      });
      opened.push(sql);
      return sql;
    },
    async stop() {
      await Promise.all(opened.map((s) => s.end({ timeout: 1 })));
      await container.stop();
    },
  };
}
