
import "https://deno.land/x/dotenv/load.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.32.0/mod.ts";

// MongoDB setup
const MONGODB_URI = Deno.env.get("MONGODB_URI");
const client = new MongoClient();
await client.connect(MONGODB_URI);
const db = client.database("speechApp");
const transcriptions = db.collection("transcriptions");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Fetch transcription history
  if (req.method === "GET") {
    // TODO: Replace with real user ID from auth/session
    const userId = "demo-user";
    const history = await transcriptions.find({ userId }).sort({ createdAt: -1 }).toArray();
    return new Response(JSON.stringify(history), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Delete a transcription
  if (req.method === "DELETE") {
    const { id } = await req.json();
    const userId = "demo-user";
    await transcriptions.deleteOne({ _id: new ObjectId(id), userId });
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const languageCode = formData.get("language_code") as string | null;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is missing! Check your .env or deployment secrets.");
      return new Response(
        JSON.stringify({ error: "Speech-to-text service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.log("ELEVENLABS_API_KEY loaded:", ELEVENLABS_API_KEY.slice(0, 6) + "...");
    }

    // Prepare the form data for ElevenLabs API
    const apiFormData = new FormData();
    apiFormData.append("file", audioFile);
    apiFormData.append("model_id", "scribe_v2");
    apiFormData.append("tag_audio_events", "true");
    apiFormData.append("diarize", "true");
    
    if (languageCode) {
      apiFormData.append("language_code", languageCode);
    }

    console.log("Sending audio to ElevenLabs for transcription...");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid API key. Please check your ElevenLabs API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Transcription failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcription = await response.json();
    console.log("Transcription successful");

    // Save transcription to MongoDB
    const userId = "demo-user"; // TODO: Replace with real user ID from auth/session
    await transcriptions.insertOne({
      userId,
      transcription: transcription.text || transcription.transcription || "", // Adjust field as needed
      audioFilename: audioFile.name,
      audioType: audioFile.type,
      createdAt: new Date()
    });

    return new Response(JSON.stringify(transcription), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in transcribe function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
