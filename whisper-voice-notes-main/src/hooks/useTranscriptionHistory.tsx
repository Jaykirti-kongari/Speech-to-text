import { useState, useCallback } from "react";
// No Supabase logic present. Already using direct fetch to backend.

export function useTranscriptionHistory(userId: string | null) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/transcribe", {
        headers: userId ? { "X-User-Id": userId } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      setError((err as Error).message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTranscription = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/transcribe/${id}`, {
        method: "DELETE",
        headers: userId ? { "X-User-Id": userId } : {},
      });
      if (!res.ok) throw new Error("Failed to delete transcription");
      await fetchHistory();
    } catch (err) {
      setError((err as Error).message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [fetchHistory]);

  return { history, loading, error, fetchHistory, deleteTranscription };
}
