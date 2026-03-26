import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, docTypesTable } from "@workspace/db";
import {
  ListDocTypesQueryParams,
  CreateDocTypeBody,
  UpdateDocTypeParams,
  UpdateDocTypeBody,
  DeleteDocTypeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/doc-types", async (req, res): Promise<void> => {
  const parsed = ListDocTypesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const docTypes = await db
    .select()
    .from(docTypesTable)
    .where(eq(docTypesTable.dealerCode, parsed.data.dealerCode))
    .orderBy(docTypesTable.sortOrder);

  res.json(docTypes.map((d) => ({
    id: d.id,
    dealerCode: d.dealerCode,
    name: d.name,
    description: d.description,
    sortOrder: d.sortOrder,
    isRequired: d.isRequired,
    createdAt: d.createdAt,
  })));
});

router.post("/doc-types", async (req, res): Promise<void> => {
  const parsed = CreateDocTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [docType] = await db.insert(docTypesTable).values({
    dealerCode: parsed.data.dealerCode,
    name: parsed.data.name,
    description: parsed.data.description,
    sortOrder: parsed.data.sortOrder ?? 0,
    isRequired: parsed.data.isRequired ?? true,
  }).returning();

  res.status(201).json({
    id: docType.id,
    dealerCode: docType.dealerCode,
    name: docType.name,
    description: docType.description,
    sortOrder: docType.sortOrder,
    isRequired: docType.isRequired,
    createdAt: docType.createdAt,
  });
});

router.patch("/doc-types/:id", async (req, res): Promise<void> => {
  const params = UpdateDocTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDocTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
  if (parsed.data.isRequired !== undefined) updateData.isRequired = parsed.data.isRequired;

  const [updated] = await db
    .update(docTypesTable)
    .set(updateData)
    .where(eq(docTypesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Document type not found" });
    return;
  }
  res.json({
    id: updated.id,
    dealerCode: updated.dealerCode,
    name: updated.name,
    description: updated.description,
    sortOrder: updated.sortOrder,
    isRequired: updated.isRequired,
    createdAt: updated.createdAt,
  });
});

router.delete("/doc-types/:id", async (req, res): Promise<void> => {
  const params = DeleteDocTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(docTypesTable)
    .where(eq(docTypesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Document type not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
