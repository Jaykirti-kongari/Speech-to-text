import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    clearRecording,
  } = useAudioRecorder();

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleUseRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
      clearRecording();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        {!isRecording && !audioBlob && (
          <Button
            onClick={startRecording}
            disabled={disabled}
            size="lg"
            className="gap-2"
          >
            <Mic className="h-5 w-5" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
              </span>
              <span className="text-lg font-mono">{formatTime(recordingTime)}</span>
            </div>
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </div>
        )}
      </div>

      {audioUrl && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/50 p-4">
            <audio
              src={audioUrl}
              controls
              className="w-full"
            />
          </div>
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleUseRecording}
              disabled={disabled}
            >
              Use This Recording
            </Button>
            <Button
              onClick={clearRecording}
              variant="outline"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
