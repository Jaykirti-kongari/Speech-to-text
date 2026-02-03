import { formatDistanceToNow } from "date-fns";
import { FileAudio, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranscriptionHistory, TranscriptionRecord } from "@/hooks/useTranscriptionHistory";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface TranscriptionHistoryRef {
  refresh: () => Promise<void>;
}

function TranscriptionCard({ 
  transcription, 
  onDelete 
}: { 
  transcription: TranscriptionRecord;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const preview = transcription.transcription.slice(0, 150);
  const hasMore = transcription.transcription.length > 150;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(transcription.id);
      toast({
        title: "Deleted",
        description: "Transcription removed from history",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transcription",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <FileAudio className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-medium truncate">{transcription.audioFilename}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(transcription.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {expanded ? transcription.transcription : preview}
              {hasMore && !expanded && "..."}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="gap-1 h-7 px-2"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Show more
                    </>
                  )}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-7 px-2 text-destructive hover:text-destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete transcription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete this
                      transcription from your history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const TranscriptionHistory = forwardRef<TranscriptionHistoryRef>(
  function TranscriptionHistory(_, ref) {
    const { transcriptions, isLoading, error, deleteTranscription, refresh } = useTranscriptionHistory();

    useImperativeHandle(ref, () => ({
      refresh,
    }));

    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcription History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcription History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive text-center py-4">{error}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transcription History</CardTitle>
        </CardHeader>
        <CardContent>
          {transcriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transcriptions yet. Upload or record audio to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {transcriptions.map((transcription) => (
                <TranscriptionCard
                  key={transcription.id}
                  transcription={transcription}
                  onDelete={deleteTranscription}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
