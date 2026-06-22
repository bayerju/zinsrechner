import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { convert } from "officeparser";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_MARKDOWN_LENGTH = 120_000;
const CONVERSION_TIMEOUT_MS = 30_000;

const allowedExtensions = new Set([
  ".csv",
  ".docx",
  ".html",
  ".md",
  ".odp",
  ".ods",
  ".odt",
  ".pdf",
  ".pptx",
  ".rtf",
  ".txt",
  ".xlsx",
]);

const textExtensions = new Set([".csv", ".html", ".md", ".txt"]);

function getExtension(filename: string) {
  const match = /\.[^.]+$/.exec(filename.toLowerCase());
  return match?.[0] ?? "";
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Document conversion timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse("No file uploaded", 400);
  }

  if (file.size <= 0) {
    return errorResponse("Uploaded file is empty", 400);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse("File is larger than 10 MB", 413);
  }

  const extension = getExtension(file.name);
  if (!allowedExtensions.has(extension)) {
    return errorResponse("Unsupported file type", 415);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const tmpPath = join(tmpdir(), `zinsrechner-${randomUUID()}${extension}`);
  const warnings: string[] = [];

  try {
    if (textExtensions.has(extension)) {
      const markdown = buffer.toString("utf8").trim();
      if (!markdown) {
        return errorResponse("No text could be extracted from the document", 422);
      }

      return NextResponse.json({
        filename: file.name,
        extension,
        markdown:
          markdown.length > MAX_MARKDOWN_LENGTH
            ? `${markdown.slice(0, MAX_MARKDOWN_LENGTH)}\n\n[Dokument wurde gekuerzt.]`
            : markdown,
        truncated: markdown.length > MAX_MARKDOWN_LENGTH,
        warnings: [],
      });
    }

    await writeFile(tmpPath, buffer);
    const result = await withTimeout(
      convert(tmpPath, "md", {
        parseConfig: {
          extractAttachments: false,
          includeRawContent: false,
          ocr: false,
        },
        generatorConfig: {
          includeImages: false,
          includeCharts: false,
          includeFormatting: false,
          renderMetadata: false,
        },
        onWarning: (issue) => warnings.push(issue.message),
      }),
      CONVERSION_TIMEOUT_MS,
    );
    const rawValue = result.value;
    const markdown = (
      typeof rawValue === "string"
        ? rawValue
        : rawValue == null
          ? ""
          : JSON.stringify(rawValue)
    ).trim();

    if (!markdown) {
      return errorResponse("No text could be extracted from the document", 422);
    }

    return NextResponse.json({
      filename: file.name,
      extension,
      markdown:
        markdown.length > MAX_MARKDOWN_LENGTH
          ? `${markdown.slice(0, MAX_MARKDOWN_LENGTH)}\n\n[Dokument wurde gekuerzt.]`
          : markdown,
      truncated: markdown.length > MAX_MARKDOWN_LENGTH,
      warnings: [...warnings, ...result.messages.map((issue) => issue.message)],
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Document conversion failed",
      500,
    );
  } finally {
    await rm(tmpPath, { force: true });
  }
}
