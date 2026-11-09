"use client";
import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import { Spinner } from "./ui";

interface Props {
  onUploadComplete: () => void;
  compact?: boolean;
}

interface UploadResult {
  filename: string;
  error?: string;
}

export function UploadZone({ onUploadComplete, compact }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateClient = (file: File): string | null => {
    if (file.size === 0) return `${file.name}: File is empty`;
    if (file.size > 15 * 1024 * 1024) return `${file.name}: Too large (max 15MB)`;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (![".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return `${file.name}: Unsupported type ${ext}`;
    return null;
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setError(null); setSuccess(null);

    // Client validation
    for (const f of files) {
      const err = validateClient(f);
      if (err) { setError(err); return; }
    }
    if (files.length > 5) { setError("Maximum 5 files at once"); return; }

    setSelectedFiles(files);
    // Auto upload
    await doUpload(files);
  };

  const doUpload = async (files: File[]) => {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));

    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data: { documents?: UploadResult[]; error?: string; message?: string; success?: boolean } = await res.json();

      if (!res.ok && !Array.isArray(data.documents)) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (!Array.isArray(data.documents)) {
        throw new Error(data.error || "The upload service returned an invalid response.");
      }

      // Handle partial success (207) or full success
      const failed = data.documents.filter((d) => d.error);
      const succeeded = data.documents.filter((d) => !d.error);

      if (failed.length > 0) {
        const msg = failed.map((f) => `${f.filename}: ${f.error}`).join(" | ");
        // If at least one succeeded, show success + warning
        if (succeeded.length > 0) {
          setSuccess(data.message || `Processed ${succeeded.length}/${files.length}`);
          setError(msg);
        } else {
          setError(msg);
        }
      } else if (succeeded.length > 0 || data.success) {
        setSuccess(data.message || "Upload successful!");
      } else if (data.error) {
        setError(data.error);
      }

      if (succeeded.length > 0) {
        setSelectedFiles([]);
        if (inputRef.current) inputRef.current.value = "";
        onUploadComplete();
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setError(null);
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
          className={`rounded-2xl border-2 border-dashed p-4 text-center transition ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
        >
          <Upload className="w-6 h-6 mx-auto text-indigo-600" />
          <div className="mt-2 text-sm font-medium">Drop files or</div>
          <label className="mt-2 inline-flex px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-medium cursor-pointer hover:bg-indigo-700">
            {uploading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading</span> : "Browse"}
            <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp" className="hidden" onChange={e=> e.target.files && handleFiles(e.target.files)} disabled={uploading} />
          </label>
          <div className="text-[11px] text-slate-400 mt-2">PDF • DOCX • TXT • PNG/JPG OCR • 15MB</div>
        </div>

        {selectedFiles.length>0 && (
          <div className="space-y-2">
            {selectedFiles.map(f=>(
              <div key={f.name} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl text-xs">
                <FileText className="w-4 h-4 text-indigo-600"/><span className="flex-1 truncate">{f.name}</span><span className="text-slate-500">{(f.size/1024).toFixed(1)}KB</span>
              </div>
            ))}
          </div>
        )}
        {uploading && <div className="flex items-center gap-2 text-xs text-indigo-600"><Spinner size={12}/> Uploading {selectedFiles.length} file(s)...</div>}
        {error && <div className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>{error}</div>}
        {success && <div className="flex gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700"><CheckCircle2 className="w-4 h-4 shrink-0"/>{success}</div>}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
        className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200"}`}
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
          <Upload className="w-6 h-6 text-white" />
        </div>
        <div className="mt-4 font-medium">Drag & drop your documents here</div>
        <div className="text-sm text-slate-500 mt-1">or click to browse — supports multiple files (max 5)</div>

        {/* Visible file input - not inside label to avoid nesting issues */}
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp"
            className="hidden"
            id="file-upload-input"
            onChange={e=> { if (e.target.files) handleFiles(e.target.files); }}
            disabled={uploading}
          />
          <label htmlFor="file-upload-input" className={`inline-flex px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition ${uploading ? "bg-slate-200 text-slate-500" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"}`}>
            {uploading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Uploading & Processing...</span> : "Browse Files"}
          </label>
        </div>

        {selectedFiles.length>0 && (
          <div className="mt-4 max-w-md mx-auto space-y-2 text-left">
            {selectedFiles.map(f=>(
              <div key={f.name} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                <FileText className="w-5 h-5 text-indigo-600"/><div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{f.name}</div><div className="text-xs text-slate-500">{(f.size/1024).toFixed(1)} KB • {f.type || "unknown"}</div></div>
                {!uploading && <button onClick={clearSelection} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4"/></button>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-slate-400">Scanned PDFs and image uploads are OCR-processed. We validate file types and sizes server-side.</div>
      </div>

      {error && <div className="mt-4 flex gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>{error}</div>}
      {success && <div className="mt-4 flex gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700"><CheckCircle2 className="w-5 h-5 shrink-0"/>{success}</div>}
      {uploading && <div className="mt-3 text-center text-xs text-indigo-600 animate-pulse">Processing document — extracting text, chunking, indexing...</div>}
    </div>
  );
}
