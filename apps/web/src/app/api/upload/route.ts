import { NextRequest, NextResponse } from "next/server";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomUUID } from "crypto";

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || "blog-images";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  // Auth check — only admin can upload
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate a unique blob name
    const ext = file.name.split(".").pop() || "jpg";
    const blobName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    // Upload to Azure Blob Storage
    const credential = new StorageSharedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
    const blobService = new BlobServiceClient(
      `https://${ACCOUNT_NAME}.blob.core.windows.net`,
      credential
    );
    const container = blobService.getContainerClient(CONTAINER_NAME);
    const blockBlob = container.getBlockBlobClient(blobName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: file.type,
        blobCacheControl: "public, max-age=31536000, immutable",
      },
    });

    const url = `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
