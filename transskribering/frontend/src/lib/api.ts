import type {
  DocumentType,
  DocumentTypeInfo,
  GeneratedDocument,
  JobDetail,
  JobOut,
  JobStatusOut,
} from "./types";

const BASE = "/api";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Fejl ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      // fall through
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface UploadOptions {
  title?: string;
  transcription_mode: "verbatim" | "cleaned";
  timestamp_mode: "none" | "paragraph" | "interval" | "speaker";
  speaker_detection_enabled: boolean;
  onProgress?: (percent: number) => void;
}

export function uploadFile(file: File, options: UploadOptions): Promise<JobOut> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    if (options.title) form.append("title", options.title);
    form.append("transcription_mode", options.transcription_mode);
    form.append("timestamp_mode", options.timestamp_mode);
    form.append("speaker_detection_enabled", String(options.speaker_detection_enabled));

    xhr.open("POST", `${BASE}/transcriptions/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          reject(new Error("Ugyldigt svar fra serveren."));
        }
      } else {
        let message = `Fejl ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (typeof body?.detail === "string") message = body.detail;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Netværket svarede ikke. Tjek forbindelsen og prøv igen."));
    xhr.send(form);
  });
}

export async function startJob(id: string): Promise<JobStatusOut> {
  const res = await fetch(`${BASE}/transcriptions/${id}/start`, { method: "POST" });
  return jsonOrThrow<JobStatusOut>(res);
}

export async function listJobs(): Promise<JobOut[]> {
  const res = await fetch(`${BASE}/transcriptions`);
  return jsonOrThrow<JobOut[]>(res);
}

export async function getJob(id: string): Promise<JobDetail> {
  const res = await fetch(`${BASE}/transcriptions/${id}`);
  return jsonOrThrow<JobDetail>(res);
}

export async function getJobStatus(id: string): Promise<JobStatusOut> {
  const res = await fetch(`${BASE}/transcriptions/${id}/status`);
  return jsonOrThrow<JobStatusOut>(res);
}

export async function updateJob(
  id: string,
  payload: { title?: string; edited_text?: string }
): Promise<JobDetail> {
  const res = await fetch(`${BASE}/transcriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<JobDetail>(res);
}

export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`${BASE}/transcriptions/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Sletning fejlede (${res.status})`);
  }
}

export function audioUrl(id: string): string {
  return `${BASE}/transcriptions/${id}/audio`;
}

export function exportUrl(id: string, format: "txt" | "docx" | "pdf" | "srt"): string {
  return `${BASE}/transcriptions/${id}/export/${format}`;
}

export async function listDocumentTypes(): Promise<DocumentTypeInfo[]> {
  const res = await fetch(`${BASE}/transcriptions/meta/document-types`);
  return jsonOrThrow<DocumentTypeInfo[]>(res);
}

export async function generateDocument(id: string, type: DocumentType): Promise<GeneratedDocument> {
  const res = await fetch(`${BASE}/transcriptions/${id}/documents/${type}`, { method: "POST" });
  return jsonOrThrow<GeneratedDocument>(res);
}

export async function downloadDocumentDocx(
  id: string,
  type: DocumentType,
  content: string,
  suggestedName: string
): Promise<void> {
  const res = await fetch(`${BASE}/transcriptions/${id}/documents/${type}/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    let message = `Download fejlede (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
