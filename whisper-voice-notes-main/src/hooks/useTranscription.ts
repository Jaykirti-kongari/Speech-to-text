import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface TranscriptionResult {
  text: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
  }>;
}

interface UseTranscriptionReturn {
  isTranscribing: boolean;
  transcribe: (audioBlob: Blob, fileName: string) => Promise<TranscriptionResult | null>;
}

export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);

  const transcribe = async (audioBlob: Blob, fileName: string): Promise<TranscriptionResult | null> => {
    setIsTranscribing(true);

    try {
      // Create form data for the backend
      const formData = new FormData();
      formData.append("audio", audioBlob, fileName);

      // Call the backend
      const response = await fetch(
        "/transcribe",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        // Backend may respond with JSON detailing provider/status/details
        let msg = `Transcription failed (HTTP ${response.status})`;
        const raw = await response.text().catch(() => "");
        if (raw) {
          try {
            const err = JSON.parse(raw);
            if (err?.provider) msg += ` - provider: ${err.provider}`;
            if (err?.error) msg += `: ${err.error}`;
            if (err?.details) msg += ` — ${typeof err.details === 'string' ? err.details : JSON.stringify(err.details)}`;

            // Helpful suggestions
            if (err.provider === "openai" && (response.status === 401 || /invalid api key/i.test(err?.details || ''))) {
              msg += " — check OPENAI_API_KEY in backend/.env";
            }
            if (err.provider === "elevenlabs" && (response.status === 401 || /invalid api key/i.test(err?.details || ''))) {
              msg += " — check ELEVENLABS_API_KEY in backend/.env";
            }
          } catch {
            msg += `: ${raw}`;
          }
        }

        throw new Error(msg);
      }

      const result: TranscriptionResult = await response.json();

      // Optionally the backend may return provider/status/details for debugging
      if ((result as any)?.warning) {
        toast({
          title: "Transcription",
          description: (result as any).warning,
        });
      }

      return result;
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        title: "Transcription failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTranscribing(false);
    }
  };

  return {
    isTranscribing,
    transcribe,
  };
}
