"use client";

import { useRef, useState } from "react";
import type { PolicyCandidate } from "@/types/policy";

export default function DashboardPage() {
  // 1. 인풋 영역 상태
  const [file, setFile] = useState<File | null>(null);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. 검수 테이블 상태
  const [candidates, setCandidates] = useState<PolicyCandidate[]>([]);

  // 3. 적재 승인 상태
  const [isCommitting, setIsCommitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  async function handleParse() {
    if (!file && !figmaUrl.trim()) {
      setError("엑셀 파일 또는 Figma URL 중 하나는 입력해주세요.");
      return;
    }
    setError(null);
    setMessage(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (figmaUrl.trim()) formData.append("figmaUrl", figmaUrl.trim());

      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "파싱에 실패했습니다.");

      setCandidates((prev) => [...prev, ...(data.candidates as PolicyCandidate[])]);
      setFile(null);
      setFigmaUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsParsing(false);
    }
  }

  function patchCandidate(id: string, patch: Partial<PolicyCandidate>) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCandidate(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleCommit() {
    setError(null);
    setMessage(null);
    setIsCommitting(true);
    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "지식창고 적재에 실패했습니다.");

      setMessage(`${data.committed.length}개의 정책을 지식창고에 적재했습니다.`);
      setCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">정책 싱크 · 영향도 분석 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          엑셀 정책 문서와 Figma 화면설계서를 업로드해 정책 후보를 생성하고, 검수 후 지식창고에 적재합니다.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* 인풋 영역 */}
      <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">1. 정책 문서 업로드</h2>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-sm font-medium text-slate-700">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">
                엑셀(.xlsx) 파일을 드래그하거나 클릭해 업로드하세요
              </p>
              <p className="mt-1 text-xs text-slate-400">첫 번째 시트의 각 행을 정책 후보로 변환합니다.</p>
            </>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Figma 파일 URL</label>
          <input
            type="url"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            placeholder="https://www.figma.com/design/..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <button
          onClick={handleParse}
          disabled={isParsing}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isParsing ? "파싱 중..." : "파싱 시작"}
        </button>
      </section>

      {/* 검수 테이블 영역 */}
      <section className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          2. 정책 후보 검수 ({candidates.length}건)
        </h2>

        {candidates.length === 0 ? (
          <p className="text-sm text-slate-400">
            아직 생성된 정책 후보가 없습니다. 위에서 문서를 파싱해주세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="w-1/6 py-2 pr-2">제목</th>
                  <th className="w-1/3 py-2 pr-2">설명</th>
                  <th className="w-1/12 py-2 pr-2">카테고리</th>
                  <th className="w-1/6 py-2 pr-2">키워드</th>
                  <th className="w-16 py-2 pr-2">신뢰도</th>
                  <th className="w-12 py-2" />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2">
                      <input
                        value={c.title}
                        onChange={(e) => patchCandidate(c.id, { title: e.target.value })}
                        className="w-full rounded border border-slate-200 px-2 py-1 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <textarea
                        value={c.description}
                        onChange={(e) => patchCandidate(c.id, { description: e.target.value })}
                        rows={2}
                        className="w-full resize-y rounded border border-slate-200 px-2 py-1 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={c.category}
                        onChange={(e) => patchCandidate(c.id, { category: e.target.value })}
                        className="w-full rounded border border-slate-200 px-2 py-1 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={c.keywords.join(", ")}
                        onChange={(e) =>
                          patchCandidate(c.id, {
                            keywords: e.target.value
                              .split(",")
                              .map((k) => k.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pr-2 text-slate-500">{Math.round(c.confidence * 100)}%</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => removeCandidate(c.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 적재 승인 영역 */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">3. 지식창고 적재</h2>
        <p className="mb-4 text-sm text-slate-500">
          검수를 마친 {candidates.length}건의 정책을 최종 승인하여 지식창고에 적재합니다. 화면에서 삭제한
          항목은 거절 처리됩니다.
        </p>
        <button
          onClick={handleCommit}
          disabled={isCommitting || candidates.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isCommitting ? "적재 중..." : "최종 적재 승인"}
        </button>
      </section>
    </main>
  );
}
