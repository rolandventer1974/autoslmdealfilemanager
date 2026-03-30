import { Router, type IRouter } from "express";
import { eq, and, gte, lte, or, ilike, sql, desc } from "drizzle-orm";
import { db, dealFilesTable, documentsTable, docTypesTable, apiKeysTable } from "@workspace/db";
import { resolveCurrentUser, isManagerRole } from "../lib/session.js";

import {
  ListDealFilesQueryParams,
  CreateDealFileBody,
  GetDealFileParams,
  UpdateDealFileParams,
  UpdateDealFileBody,
  DeleteDealFileParams,
  ListDocumentsParams,
  UploadDocumentParams,
  UploadDocumentBody,
  DeleteDocumentParams,
  IngestOtpBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getDealFileWithCompletion(dealFileId: number, dealerCode: string) {
  const file = await db.select().from(dealFilesTable).where(eq(dealFilesTable.id, dealFileId));
  if (!file[0]) return null;

  const docs = await db.select().from(documentsTable).where(eq(documentsTable.dealFileId, dealFileId));
  const requiredDocTypes = await db.select().from(docTypesTable).where(
    and(eq(docTypesTable.dealerCode, dealerCode), eq(docTypesTable.isRequired, true))
  );

  const docsRequired = requiredDocTypes.length || 1;
  const docsUploaded = docs.length;
  const completionPercent = Math.round((docsUploaded / docsRequired) * 100);
  const status = docsUploaded >= docsRequired ? "complete" : "incomplete";

  return {
    ...file[0],
    docsUploaded,
    docsRequired,
    completionPercent,
    status,
  };
}

router.get("/deal-files", async (req, res): Promise<void> => {
  const parsed = ListDealFilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, dateFrom, dateTo, status, dealerCode } = parsed.data;

  const currentUser = await resolveCurrentUser(req);

  const conditions = [];
  if (dealerCode) conditions.push(eq(dealFilesTable.dealerCode, dealerCode));
  if (dateFrom) conditions.push(gte(dealFilesTable.createdAt, new Date(dateFrom + "T00:00:00.000Z")));
  if (dateTo) conditions.push(lte(dealFilesTable.createdAt, new Date(dateTo + "T23:59:59.999Z")));
  if (search) {
    conditions.push(
      or(
        ilike(dealFilesTable.customerName, `%${search}%`),
        ilike(dealFilesTable.mobileNumber, `%${search}%`)
      )!
    );
  }

  if (currentUser && !isManagerRole(currentUser.role)) {
    conditions.push(
      or(
        eq(dealFilesTable.createdByUserId, currentUser.id),
        ilike(dealFilesTable.salesExecutive, currentUser.name || currentUser.username)
      )!
    );
  }

  const files = await db
    .select()
    .from(dealFilesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dealFilesTable.createdAt));

  const result = await Promise.all(
    files.map(async (file) => {
      const docs = await db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(eq(documentsTable.dealFileId, file.id));
      const requiredDocTypes = await db.select({ count: sql<number>`count(*)` }).from(docTypesTable).where(
        and(eq(docTypesTable.dealerCode, file.dealerCode), eq(docTypesTable.isRequired, true))
      );

      const docsUploaded = Number(docs[0]?.count || 0);
      const docsRequired = Number(requiredDocTypes[0]?.count || 1);
      const completionPercent = Math.round((docsUploaded / docsRequired) * 100);
      const fileStatus = docsUploaded >= docsRequired ? "complete" : "incomplete";

      return {
        id: file.id,
        dealerCode: file.dealerCode,
        customerName: file.customerName,
        idNumber: file.idNumber,
        email: file.email,
        mobileNumber: file.mobileNumber,
        vehicleYear: file.vehicleYear,
        vehicleMake: file.vehicleMake,
        vehicleModel: file.vehicleModel,
        vehicleSpec: file.vehicleSpec,
        vinNumber: file.vinNumber,
        salesExecutive: file.salesExecutive,
        salesManager: file.salesManager,
        financeCompany: file.financeCompany,
        dealNumber: file.dealNumber,
        status: fileStatus,
        docsUploaded,
        docsRequired,
        completionPercent,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };
    })
  );

  const filtered = status && status !== "all"
    ? result.filter((f) => f.status === status)
    : result;

  res.json(filtered);
});

router.post("/deal-files", async (req, res): Promise<void> => {
  const parsed = CreateDealFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerName, idNumber, email, mobileNumber, salesExecutive } = parsed.data;
  const missingFields: string[] = [];
  if (!customerName?.trim()) missingFields.push("Customer Name");
  if (!idNumber?.trim()) missingFields.push("ID Number");
  if (!email?.trim()) missingFields.push("Email Address");
  if (!mobileNumber?.trim()) missingFields.push("Mobile Number");
  if (!salesExecutive?.trim()) missingFields.push("Sales Executive");
  if (missingFields.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` });
    return;
  }

  const creator = await resolveCurrentUser(req);

  const [file] = await db.insert(dealFilesTable).values({
    dealerCode: parsed.data.dealerCode,
    createdByUserId: creator?.id ?? null,
    customerName: parsed.data.customerName,
    idNumber: parsed.data.idNumber,
    email: parsed.data.email,
    mobileNumber: parsed.data.mobileNumber,
    vehicleYear: parsed.data.vehicleYear,
    vehicleMake: parsed.data.vehicleMake,
    vehicleModel: parsed.data.vehicleModel,
    vehicleSpec: parsed.data.vehicleSpec,
    vinNumber: parsed.data.vinNumber,
    salesExecutive: parsed.data.salesExecutive,
    salesManager: parsed.data.salesManager,
    financeCompany: parsed.data.financeCompany,
    dealNumber: parsed.data.dealNumber,
  }).returning();

  res.status(201).json({
    id: file.id,
    dealerCode: file.dealerCode,
    customerName: file.customerName,
    idNumber: file.idNumber,
    email: file.email,
    mobileNumber: file.mobileNumber,
    vehicleYear: file.vehicleYear,
    vehicleMake: file.vehicleMake,
    vehicleModel: file.vehicleModel,
    vehicleSpec: file.vehicleSpec,
    vinNumber: file.vinNumber,
    salesExecutive: file.salesExecutive,
    salesManager: file.salesManager,
    financeCompany: file.financeCompany,
    dealNumber: file.dealNumber,
    status: "incomplete",
    docsUploaded: 0,
    docsRequired: 1,
    completionPercent: 0,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  });
});

router.get("/deal-files/:id", async (req, res): Promise<void> => {
  const params = GetDealFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [file] = await db.select().from(dealFilesTable).where(eq(dealFilesTable.id, params.data.id));
  if (!file) {
    res.status(404).json({ error: "Deal file not found" });
    return;
  }

  const docs = await db.select().from(documentsTable).where(eq(documentsTable.dealFileId, file.id));
  const requiredDocTypes = await db.select({ count: sql<number>`count(*)` }).from(docTypesTable).where(
    and(eq(docTypesTable.dealerCode, file.dealerCode), eq(docTypesTable.isRequired, true))
  );

  const docsUploaded = docs.length;
  const docsRequired = Number(requiredDocTypes[0]?.count || 1);
  const completionPercent = Math.round((docsUploaded / docsRequired) * 100);
  const fileStatus = docsUploaded >= docsRequired ? "complete" : "incomplete";

  res.json({
    id: file.id,
    dealerCode: file.dealerCode,
    customerName: file.customerName,
    idNumber: file.idNumber,
    email: file.email,
    mobileNumber: file.mobileNumber,
    vehicleYear: file.vehicleYear,
    vehicleMake: file.vehicleMake,
    vehicleModel: file.vehicleModel,
    vehicleSpec: file.vehicleSpec,
    vinNumber: file.vinNumber,
    salesExecutive: file.salesExecutive,
    salesManager: file.salesManager,
    financeCompany: file.financeCompany,
    dealNumber: file.dealNumber,
    status: fileStatus,
    docsUploaded,
    docsRequired,
    completionPercent,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    documents: docs.map((d) => ({
      id: d.id,
      dealFileId: d.dealFileId,
      docTypeId: d.docTypeId,
      docTypeName: d.docTypeName,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      fileType: d.fileType,
      fileSize: d.fileSize,
      source: d.source,
      uploadedAt: d.uploadedAt,
    })),
  });
});

router.patch("/deal-files/:id", async (req, res): Promise<void> => {
  const params = UpdateDealFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDealFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const fields = ["customerName", "idNumber", "email", "mobileNumber", "vehicleYear",
    "vehicleMake", "vehicleModel", "vehicleSpec", "vinNumber",
    "salesExecutive", "salesManager", "financeCompany", "dealNumber"] as const;

  for (const field of fields) {
    if ((parsed.data as Record<string, unknown>)[field] !== undefined) {
      const dbField = field.replace(/([A-Z])/g, "_$1").toLowerCase();
      updateData[dbField] = (parsed.data as Record<string, unknown>)[field];
    }
  }

  const [updated] = await db
    .update(dealFilesTable)
    .set(updateData)
    .where(eq(dealFilesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Deal file not found" });
    return;
  }

  const docs = await db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(eq(documentsTable.dealFileId, updated.id));
  const requiredDocTypes = await db.select({ count: sql<number>`count(*)` }).from(docTypesTable).where(
    and(eq(docTypesTable.dealerCode, updated.dealerCode), eq(docTypesTable.isRequired, true))
  );
  const docsUploaded = Number(docs[0]?.count || 0);
  const docsRequired = Number(requiredDocTypes[0]?.count || 1);
  const completionPercent = Math.round((docsUploaded / docsRequired) * 100);
  const fileStatus = docsUploaded >= docsRequired ? "complete" : "incomplete";

  res.json({
    id: updated.id,
    dealerCode: updated.dealerCode,
    customerName: updated.customerName,
    idNumber: updated.idNumber,
    email: updated.email,
    mobileNumber: updated.mobileNumber,
    vehicleYear: updated.vehicleYear,
    vehicleMake: updated.vehicleMake,
    vehicleModel: updated.vehicleModel,
    vehicleSpec: updated.vehicleSpec,
    vinNumber: updated.vinNumber,
    salesExecutive: updated.salesExecutive,
    salesManager: updated.salesManager,
    financeCompany: updated.financeCompany,
    dealNumber: updated.dealNumber,
    status: fileStatus,
    docsUploaded,
    docsRequired,
    completionPercent,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

router.delete("/deal-files/:id", async (req, res): Promise<void> => {
  const params = DeleteDealFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(dealFilesTable)
    .where(eq(dealFilesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Deal file not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/deal-files/:id/documents", async (req, res): Promise<void> => {
  const params = ListDocumentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const docs = await db.select().from(documentsTable).where(eq(documentsTable.dealFileId, params.data.id));
  res.json(docs.map((d) => ({
    id: d.id,
    dealFileId: d.dealFileId,
    docTypeId: d.docTypeId,
    docTypeName: d.docTypeName,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    fileType: d.fileType,
    fileSize: d.fileSize,
    source: d.source,
    uploadedAt: d.uploadedAt,
  })));
});

router.post("/deal-files/:id/documents", async (req, res): Promise<void> => {
  const params = UploadDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UploadDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db.insert(documentsTable).values({
    dealFileId: params.data.id,
    docTypeId: parsed.data.docTypeId,
    docTypeName: parsed.data.docTypeName,
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.fileUrl,
    fileType: parsed.data.fileType,
    fileSize: parsed.data.fileSize,
    source: parsed.data.source || "upload",
  }).returning();

  res.status(201).json({
    id: doc.id,
    dealFileId: doc.dealFileId,
    docTypeId: doc.docTypeId,
    docTypeName: doc.docTypeName,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    source: doc.source,
    uploadedAt: doc.uploadedAt,
  });
});

router.delete("/deal-files/:id/documents/:docId", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(documentsTable)
    .where(and(eq(documentsTable.id, params.data.docId), eq(documentsTable.dealFileId, params.data.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/api-ingest/otp", async (req, res): Promise<void> => {
  const parsed = IngestOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [keyRecord] = await db.select().from(apiKeysTable).where(
    and(eq(apiKeysTable.dealerCode, parsed.data.dealerCode), eq(apiKeysTable.apiKey, parsed.data.apiKey))
  );

  if (!keyRecord) {
    res.status(401).json({ error: "Invalid API key for dealer code" });
    return;
  }

  let [existingFile] = parsed.data.dealNumber
    ? await db.select().from(dealFilesTable).where(
        and(
          eq(dealFilesTable.dealerCode, parsed.data.dealerCode),
          eq(dealFilesTable.dealNumber, parsed.data.dealNumber)
        )
      )
    : [undefined];

  let dealFileId: number;

  if (!existingFile) {
    const [file] = await db.insert(dealFilesTable).values({
      dealerCode: parsed.data.dealerCode,
      customerName: parsed.data.customerName,
      idNumber: parsed.data.idNumber,
      email: parsed.data.email,
      mobileNumber: parsed.data.mobileNumber,
      vehicleYear: parsed.data.vehicleYear,
      vehicleMake: parsed.data.vehicleMake,
      vehicleModel: parsed.data.vehicleModel,
      vehicleSpec: parsed.data.vehicleSpec,
      vinNumber: parsed.data.vinNumber,
      salesExecutive: parsed.data.salesExecutive,
      salesManager: parsed.data.salesManager,
      financeCompany: parsed.data.financeCompany,
      dealNumber: parsed.data.dealNumber,
    }).returning();
    dealFileId = file.id;
  } else {
    dealFileId = existingFile.id;
  }

  await db.insert(documentsTable).values({
    dealFileId,
    docTypeName: "Offer to Purchase (OTP)",
    fileName: parsed.data.otpFileName,
    fileUrl: parsed.data.otpFileUrl,
    fileType: "application/pdf",
    source: "api",
  });

  const [updatedFile] = await db.select().from(dealFilesTable).where(eq(dealFilesTable.id, dealFileId));
  const docs = await db.select({ count: sql<number>`count(*)` }).from(documentsTable).where(eq(documentsTable.dealFileId, dealFileId));
  const requiredDocTypes = await db.select({ count: sql<number>`count(*)` }).from(docTypesTable).where(
    and(eq(docTypesTable.dealerCode, parsed.data.dealerCode), eq(docTypesTable.isRequired, true))
  );
  const docsUploaded = Number(docs[0]?.count || 0);
  const docsRequired = Number(requiredDocTypes[0]?.count || 1);
  const completionPercent = Math.round((docsUploaded / docsRequired) * 100);
  const fileStatus = docsUploaded >= docsRequired ? "complete" : "incomplete";

  res.json({
    id: updatedFile!.id,
    dealerCode: updatedFile!.dealerCode,
    customerName: updatedFile!.customerName,
    idNumber: updatedFile!.idNumber,
    email: updatedFile!.email,
    mobileNumber: updatedFile!.mobileNumber,
    vehicleYear: updatedFile!.vehicleYear,
    vehicleMake: updatedFile!.vehicleMake,
    vehicleModel: updatedFile!.vehicleModel,
    vehicleSpec: updatedFile!.vehicleSpec,
    vinNumber: updatedFile!.vinNumber,
    salesExecutive: updatedFile!.salesExecutive,
    salesManager: updatedFile!.salesManager,
    financeCompany: updatedFile!.financeCompany,
    dealNumber: updatedFile!.dealNumber,
    status: fileStatus,
    docsUploaded,
    docsRequired,
    completionPercent,
    createdAt: updatedFile!.createdAt,
    updatedAt: updatedFile!.updatedAt,
  });
});

export default router;
