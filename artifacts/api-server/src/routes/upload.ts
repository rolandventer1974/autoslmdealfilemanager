import { Router, type IRouter } from "express";
import { PresignUploadBody } from "@workspace/api-zod";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post("/upload/presign", async (req, res): Promise<void> => {
  const parsed = PresignUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ext = path.extname(parsed.data.fileName);
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const fileUrl = `/api/uploads/${uniqueName}`;
  const uploadUrl = `/api/upload/file/${uniqueName}`;

  res.json({
    uploadUrl,
    fileUrl,
    fileName: uniqueName,
  });
});

router.put("/upload/file/:filename", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const filename = path.basename(raw);
  const filePath = path.join(UPLOADS_DIR, filename);

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, buffer);
    res.json({ success: true, fileUrl: `/api/uploads/${filename}` });
  });
  req.on("error", () => {
    res.status(500).json({ error: "Upload failed" });
  });
});

router.get("/uploads/:filename", (req, res): void => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const filename = path.basename(raw);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
