import { foreignPattern, ownerOf, schemaOf } from "./schemas.mjs";

/**
 * "No query that names another service's schema" (CLAUDE.md, "Never").
 * Flags any string or template text that names a schema the file's service
 * does not own. Outside services/ every service schema is foreign.
 */
export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow naming another service's schema" },
    schema: [{ type: "object", properties: { services: { type: "array", items: { type: "string" } } }, additionalProperties: false }],
    messages: {
      foreign: "'{{schema}}' is another service's schema. Call that service's batch method instead (docs/azure/prd.md, \"Reading another service's data\").",
    },
  },
  create(context) {
    const services = context.options[0]?.services ?? [];
    const own = ownerOf(context.filename);
    const foreign = services.filter((s) => s !== own).map(schemaOf);
    const pattern = foreignPattern(foreign);
    if (!pattern) return {};
    const check = (node, text) => {
      const m = pattern.exec(text);
      if (m) context.report({ node, messageId: "foreign", data: { schema: m[1] } });
    };
    return {
      Literal(node) {
        if (typeof node.value === "string" && node.parent?.type !== "ImportDeclaration" && node.parent?.type !== "ExportNamedDeclaration" && node.parent?.type !== "ExportAllDeclaration" && node.parent?.type !== "ImportExpression") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
