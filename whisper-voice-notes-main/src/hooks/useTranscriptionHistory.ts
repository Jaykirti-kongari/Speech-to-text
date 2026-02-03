import { useState, useEffect, useCallback } from "react";



export interface TranscriptionRecord {
  id: string;
  audioFilename: string;
  transcription: string;
  createdAt: string;
  audioType?: string;
}


interface UseTranscriptionHistoryReturn {
  transcriptions: TranscriptionRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteTranscription: (id: string) => Promise<void>;
}

export function useTranscriptionHistory(): UseTranscriptionHistoryReturn {
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/transcribe");
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setTranscriptions(
        (data || []).map((item: any) => ({
          id: item._id?.$oid || item._id || item.id,
          audioFilename: item.audioFilename || item.audio_file_name || "",
          transcription: item.transcription || item.transcription_text || "",
          createdAt: item.createdAt || item.created_at || new Date().toISOString(),
          audioType: item.audioType || item.audio_type || "",
        }))
      );
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteTranscription = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/transcribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete transcription");
      await fetchTranscriptions();
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTranscriptions]);

  return {
    transcriptions,
    isLoading,
    error,
    refresh: fetchTranscriptions,
    deleteTranscription,
  };
}
