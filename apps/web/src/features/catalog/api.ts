import { apiRequest } from "../../shared/api/client";
import type { Paginated, Taxonomy, TrackDetail, TrackListItem } from "./types";

export type TrackFilters = {
  q?: string;
  genre?: string;
  style?: string;
  key?: string;
  bpmMin?: string;
  bpmMax?: string;
  difficulty?: string;
  sort?: string;
  scope?: string;
  page?: number;
};

function toQuery(filters: TrackFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchTaxonomy() {
  return apiRequest<Taxonomy>("/taxonomy");
}

export function fetchTracks(filters: TrackFilters, token?: string | null) {
  return apiRequest<Paginated<TrackListItem>>(`/tracks${toQuery(filters)}`, {
    token,
  });
}

export function fetchTrack(slug: string, token?: string | null) {
  return apiRequest<TrackDetail>(`/tracks/${slug}`, { token });
}

export function createTrack(
  body: {
    title: string;
    artistName: string;
    genres: string[];
    styles: string[];
    difficulty?: string;
    originalKey?: string;
    bpm?: number;
  },
  token: string,
) {
  return apiRequest<TrackDetail>("/tracks", {
    method: "POST",
    token,
    body,
  });
}

export function publishTrack(
  trackId: string,
  token: string,
  body: { syncVersion?: number; changelog?: string } = {},
) {
  return apiRequest<{
    trackId: string;
    status: string;
    syncVersion: number;
    message: string;
  }>(`/tracks/${trackId}/publish`, {
    method: "POST",
    token,
    body,
  });
}

export function getTrackSync(trackId: string, token: string) {
  return apiRequest<{
    trackId: string;
    version: number;
    status: string;
    source: string;
    formatVersion: string;
    document: import("../player/types").CifraSyncDocument;
  }>(`/tracks/${trackId}/sync`, { token });
}

export function putTrackSync(
  trackId: string,
  token: string,
  document: import("../player/types").CifraSyncDocument,
) {
  return apiRequest<{
    trackId: string;
    version: number;
    status: string;
    checksum: string;
  }>(`/tracks/${trackId}/sync`, {
    method: "PUT",
    token,
    body: document,
  });
}

export function fetchPendingApprovals(token: string) {
  return apiRequest<{
    items: Array<{
      id: string;
      slug: string;
      title: string;
      artist: string | null;
      syncVersion: number | null;
      updatedAt: string;
    }>;
  }>("/admin/approvals", { token });
}

export function decideApproval(
  trackId: string,
  token: string,
  body: {
    decision: "approved" | "rejected" | "changes_requested";
    notes?: string;
  },
) {
  return apiRequest(`/admin/tracks/${trackId}/approvals`, {
    method: "POST",
    token,
    body,
  });
}

export function initUpload(
  body: {
    trackId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  },
  token: string,
) {
  return apiRequest<{
    uploadId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  }>("/media/uploads", { method: "POST", token, body });
}

export function completeUpload(
  uploadId: string,
  token: string,
  autoAnalyze = true,
) {
  return apiRequest<{
    mediaFileId: string;
    trackId: string;
    status: string;
    autoAnalyzeQueued: boolean;
    jobId: string | null;
    message: string;
  }>(`/media/uploads/${uploadId}/complete`, {
    method: "POST",
    token,
    body: { autoAnalyze },
  });
}

export function analyzeTrack(trackId: string, token: string) {
  return apiRequest<{ jobId: string; status: string; trackId: string }>(
    `/tracks/${trackId}/analyze`,
    { method: "POST", token, body: {} },
  );
}

export function fetchJob(jobId: string, token: string) {
  return apiRequest<{
    jobId: string;
    status: string;
    progress: number;
    stage: string | null;
    etaSeconds: number | null;
    error: unknown;
    result: unknown;
    trackId: string;
  }>(`/jobs/${jobId}`, { token });
}

export function fetchFavorites(token: string) {
  return apiRequest<{ items: TrackDetail[] }>("/me/favorites", { token });
}

export function addFavorite(trackId: string, token: string) {
  return apiRequest(`/me/favorites/${trackId}`, { method: "PUT", token });
}

export function removeFavorite(trackId: string, token: string) {
  return apiRequest(`/me/favorites/${trackId}`, { method: "DELETE", token });
}

export function reportTrack(
  trackId: string,
  token: string,
  body: {
    reason: "copyright" | "inappropriate" | "spam" | "incorrect_sync" | "other";
    details?: string;
  },
) {
  return apiRequest<{ id: string; status: string; message: string }>(
    `/tracks/${trackId}/reports`,
    { method: "POST", token, body },
  );
}

export function fetchAdminMetrics(token: string) {
  return apiRequest<{
    users: number;
    tracks: {
      published: number;
      pendingApproval: number;
      processing: number;
    };
    reports: { open: number };
    jobs: { failedLast24h: number; completedLast24h: number };
    favorites: number;
    runtime: { uptimeSeconds: number; counters: Record<string, number> };
  }>("/admin/metrics", { token });
}

export function fetchAdminReports(token: string, status = "open") {
  return apiRequest<{
    items: Array<{
      id: string;
      reason: string;
      details: string | null;
      status: string;
      createdAt: string;
      track: { id: string; slug: string; title: string; status: string };
      reporter: { id: string; email: string; displayName: string };
    }>;
  }>(`/admin/reports?status=${encodeURIComponent(status)}`, { token });
}

export function resolveAdminReport(
  reportId: string,
  token: string,
  body: {
    decision: "resolved" | "dismissed";
    archiveTrack?: boolean;
    resolution?: string;
  },
) {
  return apiRequest(`/admin/reports/${reportId}/resolve`, {
    method: "POST",
    token,
    body,
  });
}
