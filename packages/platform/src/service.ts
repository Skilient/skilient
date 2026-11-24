import type { DescService } from "@bufbuild/protobuf";
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
