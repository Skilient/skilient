import type { DescService } from "@bufbuild/protobuf";
import type postgres from "postgres";
import type { ServiceImpl } from "@connectrpc/connect";
import type { ClientFactory } from "./client";
import type { Logger } from "./log";
import type { Secrets } from "./secrets";

/** Which callers ("web" or a service name) may use each method. Anything not listed is refused. */
export type CallerPolicy<S extends DescService> = { readonly [K in keyof S["method"]]: readonly string[] };

export interface ServiceDeps {
  /** This service's name, e.g. "people". */
  name: string;
  /** The replica serving calls (host name). */
  instance: string;
  clients: ClientFactory;
  logger: Logger;
  secrets: Secrets;
  /**
   * This service's database connection, as its own role (svc_<name>), owned and closed by the host.
   * Throws for a host given no database (services that own no data never call it).
   */
  database(): postgres.Sql;
  /** Plain HTTP GET routes on the HTTP/1.1 port, for what is not an RPC (e.g. identity's public signing keys). */
  http: HttpRoutes;
}

export interface HttpReply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface HttpRoutes {
  get(path: string, handler: () => Promise<HttpReply>): void;
}

export interface ServiceModule<S extends DescService = DescService> {
  /** Lower-case, hyphenated: the name in SERVICES, the audience of service tokens and (with "_") the schema. */
  name: string;
  contract: S;
  callers: CallerPolicy<S>;
  create(deps: ServiceDeps): Partial<ServiceImpl<S>> | Promise<Partial<ServiceImpl<S>>>;
  /** Extra readiness checks (database, keys). */
  ready?(): Promise<boolean>;
  close?(): Promise<void>;
}

export function defineService<S extends DescService>(module: ServiceModule<S>): ServiceModule<S> {
  return module;
}
