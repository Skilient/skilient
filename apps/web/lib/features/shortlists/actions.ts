"use server";

import { z } from "zod";
import { rpcAction } from "@/lib/actions/recruit-run";
import type { ActionResult } from "@/lib/actions/result";

const uuid = z.uuid();
const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label}: at least ${min} characters.`).max(max, `${label}: at most ${max} characters.`);
const listName = text(1, 60, "List name");

export async function createShortlist(name: string): Promise<ActionResult<string>> {
  return rpcAction<typeof listName, string>({ name: "recruit.create_shortlist", entitlement: "recruit.shortlists", schema: listName, input: name, fn: "create_shortlist", args: (v) => ({ p_name: v }), revalidate: ["/recruit/shortlists"] });
}
export async function renameShortlist(id: string, name: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.rename_shortlist", entitlement: "recruit.shortlists", schema: z.object({ id: uuid, name: listName }), input: { id, name }, fn: "rename_shortlist", args: (v) => ({ p_id: v.id, p_name: v.name }), revalidate: ["/recruit/shortlists"] });
}
export async function deleteShortlist(id: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.delete_shortlist", schema: uuid, input: id, fn: "delete_shortlist", args: (v) => ({ p_id: v }), revalidate: ["/recruit/shortlists"] });
}
export async function addToShortlist(listId: string, studentId: string): Promise<ActionResult<string | null>> {
  return rpcAction<z.ZodObject<{ listId: z.ZodUUID; studentId: z.ZodUUID }>, string | null>({
    name: "recruit.shortlist_add", entitlement: "recruit.shortlists",
    schema: z.object({ listId: uuid, studentId: uuid }),
    input: { listId, studentId },
    fn: "add_to_shortlist",
    args: (v) => ({ p_list: v.listId, p_student: v.studentId }),
    revalidate: ["/recruit/shortlists", `/recruit/candidates/${studentId}`],
  });
}
export async function removeFromShortlist(itemId: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.shortlist_remove", schema: uuid, input: itemId, fn: "remove_from_shortlist", args: (v) => ({ p_item: v }), revalidate: ["/recruit/shortlists"] });
}
export async function reorderShortlist(listId: string, itemIds: string[]): Promise<ActionResult> {
  return rpcAction({
    name: "recruit.shortlist_reorder", entitlement: "recruit.shortlists",
    schema: z.object({ listId: uuid, itemIds: z.array(uuid).max(500) }),
    input: { listId, itemIds },
    fn: "reorder_shortlist",
    args: (v) => ({ p_list: v.listId, p_items: v.itemIds }),
    revalidate: [],
  });
}
export async function addNote(studentId: string, body: string): Promise<ActionResult<string>> {
  return rpcAction<z.ZodObject<{ studentId: z.ZodUUID; body: z.ZodString }>, string>({
    name: "recruit.add_note", entitlement: "recruit.shortlists",
    schema: z.object({ studentId: uuid, body: text(1, 2000, "Note") }),
    input: { studentId, body },
    fn: "add_note",
    args: (v) => ({ p_student: v.studentId, p_body: v.body }),
    revalidate: [`/recruit/candidates/${studentId}`],
  });
}
export async function deleteNote(noteId: string, studentId: string): Promise<ActionResult> {
  return rpcAction({ name: "recruit.delete_note", schema: uuid, input: noteId, fn: "delete_note", args: (v) => ({ p_id: v }), revalidate: [`/recruit/candidates/${studentId}`] });
}
