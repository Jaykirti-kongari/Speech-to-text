import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";
import { AudioRecorder } from "@/components/AudioRecorder";
import { AudioUploader } from "@/components/AudioUploader";
import { TranscriptionOutput } from "@/components/TranscriptionOutput";
import { TranscriptionHistory, TranscriptionHistoryRef } from "@/components/TranscriptionHistory";
import { useTranscription } from "@/hooks/useTranscription";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const historyRef = useRef<TranscriptionHistoryRef>(null);
  
  const { isTranscribing, transcribe } = useTranscription();

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAudioReady = async (audioBlob: Blob, source: "record" | "upload", fileName?: string) => {
    const name = fileName || `recording-${Date.now()}.webm`;
    const result = await transcribe(audioBlob, name);
    if (result) {
      setTranscriptionResult(result.text);
      // Refresh history after successful transcription
      historyRef.current?.refresh();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated={!!user} userEmail={user?.email} />
      
      <main className="container mx-auto px-4 py-8">
        {!user ? (
          <div className="max-w-md mx-auto mt-8">
            <AuthForm onSuccess={() => {}} />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column: Input Section */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audio Input</CardTitle>
                  <CardDescription>
                    Record audio directly or upload an audio file to transcribe
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="record" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="record">Record</TabsTrigger>
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                    </TabsList>
                    <TabsContent value="record" className="mt-4">
                      <AudioRecorder
                        onRecordingComplete={(blob) => handleAudioReady(blob, "record")}
                        disabled={isTranscribing}
                      />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-4">
                      <AudioUploader
                        onFileSelect={(file) => handleAudioReady(file, "upload", file.name)}
                        disabled={isTranscribing}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Transcription in progress */}
              {isTranscribing && (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-muted-foreground">Transcribing audio...</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transcription Result */}
              {transcriptionResult && !isTranscribing && (
                <TranscriptionOutput text={transcriptionResult} />
              )}
            </div>

            {/* Right Column: History */}
            <div>
              <TranscriptionHistory ref={historyRef} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
