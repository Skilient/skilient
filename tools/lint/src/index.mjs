import noForeignSchema from "./no-foreign-schema.mjs";

export { serviceNames } from "./schemas.mjs";
export const plugin = { rules: { "no-foreign-schema": noForeignSchema } };
