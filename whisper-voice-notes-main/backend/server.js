import User from "./models/User.js";
// Store user details on login/signup
app.post("/user", async (req, res) => {
  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: "Missing userId or email" });
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId, email });
  }
  res.json({ success: true, user });
});
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import Transcription from "./models/Transcription.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
console.log("ElevenLabs Key Loaded:", process.env.ELEVENLABS_API_KEY ? "YES" : "NO");

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });


const { ELEVENLABS_API_KEY, OPENAI_API_KEY, MONGODB_URI } = process.env;

// Debug: Log before connecting to MongoDB
if (MONGODB_URI) {
  const maskedUri = MONGODB_URI.replace(/(mongodb\+srv:\/\/)(.*:)(.*)(@.*)/, '$1$2*****$4');
  console.log('Attempting MongoDB connection to:', maskedUri);
}

if (!ELEVENLABS_API_KEY && !OPENAI_API_KEY) {
  console.error("No API key found. Set ELEVENLABS_API_KEY or OPENAI_API_KEY in backend/.env");
  process.exit(1);
}
if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith("sk_")) {
  console.info("OPENAI_API_KEY detected and will be used for OpenAI Whisper requests.");
}
if (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.startsWith("sk_")) {
  console.warn("ELEVENLABS_API_KEY looks like an OpenAI key (starts with sk_). If you intend to use ElevenLabs, set the correct ElevenLabs key in backend/.env.");
}
if (!MONGODB_URI) {
  console.error("MONGODB_URI is missing!");
  process.exit(1);
}

let mongoConnected = false;
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    mongoConnected = true;
    console.log("MongoDB connected");
  })
  .catch(err => {
    mongoConnected = false;
    console.error("MongoDB error:", err);
    console.error("If you're using MongoDB Atlas, make sure the current IP is whitelisted in your cluster network access settings.");
    // Do not exit the process; allow the server to run and handle requests without DB
  });

console.log("MongoDB connect() call finished (promise pending or resolved/rejected)");

// Periodic server status log
setInterval(() => {
  console.log("Server is running. MongoDB connected:", mongoConnected);
}, 10000);

// --- Local JSON fallback for development when MongoDB is unavailable ---
import { promises as fsp } from "fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = path.join(__dirname, "local_transcriptions.json");

async function ensureLocalDB() {
  // Ensure the directory exists
  const dir = path.dirname(LOCAL_DB_PATH);
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch (_) {}
  try {
    await fsp.access(LOCAL_DB_PATH);
  } catch (_) {
    await fsp.writeFile(LOCAL_DB_PATH, "[]");
  }
}

async function readLocalDB() {
  await ensureLocalDB();
  const txt = await fsp.readFile(LOCAL_DB_PATH, "utf8");
  try {
    return JSON.parse(txt);
  } catch (e) {
    console.error("Failed to parse local DB file, resetting:", e);
    await fsp.writeFile(LOCAL_DB_PATH, "[]");
    return [];
  }
}

async function writeLocalDB(arr) {
  await ensureLocalDB();
  await fsp.writeFile(LOCAL_DB_PATH, JSON.stringify(arr, null, 2));
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

// Seed local DB for development/testing if empty
async function seedLocalDB() {
  await ensureLocalDB();
  const list = await readLocalDB();
  if (!list || list.length === 0) {
    const sample = { _id: makeLocalId(), text: "Local sample transcription - hello world", createdAt: new Date().toISOString() };
    await writeLocalDB([sample]);
    console.info("Seeded local_transcriptions.json with a sample entry for development.");
  }
}

// Seed immediately (non-blocking)
seedLocalDB().catch((e) => console.warn("Failed to seed local DB:", e));
// ---------------------------------------------------------------------

app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const localExists = await (async () => { try { await fsp.access(LOCAL_DB_PATH); return true;} catch { return false;} })();
  const localCount = localExists ? (await readLocalDB()).length : 0;
  res.json({ ok: true, mongoConnected, localFallback: localExists, localCount });
});

// POST /transcribe
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  const userId = req.headers["x-user-id"] || null;
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

  try {
    // Read file into memory once so we can build fresh FormData for retries
    const fileBuffer = fs.readFileSync(req.file.path);
    const filename = req.file.originalname || path.basename(req.file.path);

    // Use OpenAI only when an explicit OPENAI_API_KEY is set or when the client forces it via ?provider=openai
    const OPENAI_KEY = OPENAI_API_KEY || null;
    const forceOpenAI = req.query && req.query.provider === "openai";

    // Safety: if ELEVENLABS_API_KEY contains an OpenAI-style key (starts with sk_) but OPENAI_API_KEY is not set, return configuration error
    if (!OPENAI_KEY && ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.startsWith("sk_") && !forceOpenAI) {
      return res.status(400).json({ error: "Configuration error: ELEVENLABS_API_KEY appears to be an OpenAI key (starts with sk_). If you want to use OpenAI set OPENAI_API_KEY in backend/.env or replace ELEVENLABS_API_KEY with a valid ElevenLabs key." });
    }

    if (forceOpenAI && !OPENAI_KEY) {
      return res.status(400).json({ provider: "openai", error: "OpenAI provider forced but OPENAI_API_KEY is missing. Set OPENAI_API_KEY in backend/.env or remove ?provider=openai." });
    }

    if (forceOpenAI || OPENAI_KEY) {
      console.info("Using OpenAI Whisper endpoint for transcription.");
      console.debug("Uploaded file:", { filename, mimetype: req.file.mimetype, size: req.file.size });

      let openaiRes;
      let attempt = 0;
      let lastErrText = null;

      // Attempt up to 2 times for transient server errors
      while (attempt < 2) {
        const openaiForm = new FormData();
        openaiForm.append("file", fileBuffer, { filename, contentType: req.file.mimetype });
        openaiForm.append("model", "whisper-1");

        const openaiHeaders = {
          ...openaiForm.getHeaders(),
          "Authorization": `Bearer ${OPENAI_KEY}`
        };

        openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: openaiHeaders,
          body: openaiForm
        });

        if (openaiRes.ok) break;

        lastErrText = await openaiRes.text();
        console.error(`OpenAI transcription attempt ${attempt + 1} failed:`, openaiRes.status, lastErrText);

        // Retry for server-side or rate-limit errors
        if (openaiRes.status >= 500 || openaiRes.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          attempt++;
          continue;
        }

        // Non-retriable error, break
        break;
      }

      if (!openaiRes.ok) {
        const details = lastErrText || await openaiRes.text();
        console.error("OpenAI final error:", openaiRes.status, details);

        // Try to parse details and return meaningful error + upstream status
        let parsed = null;
        try {
          parsed = JSON.parse(details);
        } catch (_) {}

        // If error indicates invalid API key, return 401
        const code = parsed?.error?.code || parsed?.code || null;
        if (openaiRes.status === 401 || code === "invalid_api_key") {
          return res.status(401).json({ provider: "openai", error: "Invalid OpenAI API key. Set OPENAI_API_KEY in backend/.env or check the key.", details: parsed || details });
        }

        // For other client errors, return the same status so frontend shows actionable status
        if (openaiRes.status >= 400 && openaiRes.status < 500) {
          return res.status(openaiRes.status).json({ provider: "openai", error: "OpenAI request failed", status: openaiRes.status, details: parsed || details });
        }

        // Fallback to ElevenLabs only on server-side errors and when a proper ELEVENLABS_API_KEY exists
        if (openaiRes.status >= 500 && ELEVENLABS_API_KEY) {
          console.warn("OpenAI failed with server error; falling back to ElevenLabs...");
          // continue to ElevenLabs path by reusing the same fileBuffer
          const fallbackForm = new FormData();
          fallbackForm.append("file", fileBuffer, { filename, contentType: req.file.mimetype });
          fallbackForm.append("model_id", "scribe_v2");
          fallbackForm.append("tag_audio_events", "true");
          fallbackForm.append("diarize", "true");
          const fallbackHeaders = {
            ...fallbackForm.getHeaders(),
            "xi-api-key": ELEVENLABS_API_KEY
          };
          const fb = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: fallbackHeaders, body: fallbackForm });
          if (!fb.ok) {
            const errTxt = await fb.text();
            console.error("ElevenLabs fallback also failed:", fb.status, errTxt);
            return res.status(502).json({ error: "Transcription failed (OpenAI + ElevenLabs fallback)", status: fb.status, details: errTxt });
          }
          const fbData = await fb.json();
          const text = fbData.text || fbData.transcription || "";
          // Save locally or to DB
          try {
            if (mongoConnected) {
              const transcription = await Transcription.create({ text, userId });
              return res.json({ provider: "elevenlabs", text, saved: true, transcription });
            } else {
              const list = await readLocalDB();
              const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
              list.unshift(entry);
              await writeLocalDB(list);
              return res.json({ provider: "elevenlabs", text, saved: true, transcription: entry });
            }
          } catch (dbErr) {
            console.error("Failed to save transcription to DB after fallback:", dbErr.message || dbErr);
            const list = await readLocalDB();
            const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
            list.unshift(entry);
            await writeLocalDB(list);
            return res.json({ provider: "elevenlabs", text, saved: true, transcription: entry, warning: "Saved locally after DB failure" });
          }
        }

        return res.status(502).json({ error: "Transcription failed (OpenAI)", status: openaiRes.status, details });
      }

      const data = await openaiRes.json();
      const text = data.text || data.transcription || "";

      // Save to MongoDB when possible; otherwise persist to local JSON fallback
      try {
        if (mongoConnected) {
          const transcription = await Transcription.create({ text, userId });
          return res.json({ provider: "openai", text, saved: true, transcription });
        } else {
          const list = await readLocalDB();
          const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
          list.unshift(entry);
          await writeLocalDB(list);
          return res.json({ provider: "openai", text, saved: true, transcription: entry });
        }
      } catch (dbErr) {
        console.error("Failed to save transcription to DB:", dbErr.message || dbErr);
        // Fallback to local store if DB fails during save
        const list = await readLocalDB();
        const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
        list.unshift(entry);
        await writeLocalDB(list);
        return res.json({ provider: "openai", text, saved: true, transcription: entry, warning: "Saved locally after DB failure" });
      }
    }

    // ElevenLabs path
    const formData = new FormData();
    formData.append("file", fileBuffer, { filename, contentType: req.file.mimetype });
    formData.append("model_id", "scribe_v2");
    formData.append("tag_audio_events", "true");
    formData.append("diarize", "true");

    const headers = {
      ...formData.getHeaders(),
      "xi-api-key": ELEVENLABS_API_KEY
      // Do NOT send Authorization header for ElevenLabs, only xi-api-key
    };

    console.debug("Calling ElevenLabs with headers:", Object.keys(headers));

    const elevenRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers,
      body: formData
    });

    if (elevenRes.status === 401) {
      const errBody = await elevenRes.text();
      console.error("ElevenLabs API key error:", elevenRes.status, errBody);
      return res.status(401).json({ error: "Invalid or missing ElevenLabs API key", details: errBody });
    }
    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("ElevenLabs API error:", elevenRes.status, errText);

      // Fallback to OpenAI if ElevenLabs had server errors and OpenAI key is available
      const OPENAI_KEY = OPENAI_API_KEY || (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.startsWith("sk_") ? ELEVENLABS_API_KEY : null);
      if ((elevenRes.status >= 500 || elevenRes.status === 502) && OPENAI_KEY && OPENAI_KEY !== ELEVENLABS_API_KEY) {
        console.warn("ElevenLabs failed with server error; attempting OpenAI fallback...");
        const openaiForm = new FormData();
        openaiForm.append("file", fileBuffer, { filename, contentType: req.file.mimetype });
        openaiForm.append("model", "whisper-1");
        const openaiHeaders = { ...openaiForm.getHeaders(), Authorization: `Bearer ${OPENAI_KEY}` };
        const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: openaiHeaders,
          body: openaiForm,
        });
        if (!openaiRes.ok) {
          const d = await openaiRes.text();
          console.error("OpenAI fallback failed:", openaiRes.status, d);
          return res.status(502).json({ error: "Transcription failed (ElevenLabs + OpenAI fallback)", status: openaiRes.status, details: d });
        }
        const data = await openaiRes.json();
        const text = data.text || data.transcription || "";
        // Save
        try {
          if (mongoConnected) {
            const transcription = await Transcription.create({ text });
            return res.json({ provider: "openai", text, saved: true, transcription });
          } else {
            const list = await readLocalDB();
            const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
            list.unshift(entry);
            await writeLocalDB(list);
            return res.json({ provider: "openai", text, saved: true, transcription: entry });
          }
        } catch (dbErr) {
          console.error("Failed to save transcription to DB after fallback:", dbErr.message || dbErr);
          const list = await readLocalDB();
          const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
          list.unshift(entry);
          await writeLocalDB(list);
          return res.json({ provider: "openai", text, saved: true, transcription: entry, warning: "Saved locally after DB failure" });
        }
      }

      return res.status(502).json({ error: "Transcription failed (ElevenLabs)", status: elevenRes.status, details: errText });
    }

    const data = await elevenRes.json();
    const text = data.text || data.transcription || "";

    try {
      if (mongoConnected) {
        const transcription = await Transcription.create({ text });
        return res.json({ provider: "elevenlabs", text, saved: true, transcription });
      } else {
        const list = await readLocalDB();
        const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
        list.unshift(entry);
        await writeLocalDB(list);
        return res.json({ provider: "elevenlabs", text, saved: true, transcription: entry });
      }
    } catch (dbErr) {
      console.error("Failed to save transcription to DB:", dbErr.message || dbErr);
      // Fallback to local store
      const list = await readLocalDB();
      const entry = { _id: makeLocalId(), text, createdAt: new Date().toISOString() };
      list.unshift(entry);
      await writeLocalDB(list);
      return res.json({ provider: "elevenlabs", text, saved: true, transcription: entry, warning: "Saved locally after DB failure" });
    }
  } catch (err) {
    console.error("Server error during transcription:", err);
    res.status(500).json({ error: "Server error", details: err && err.message ? err.message : String(err) });
  } finally {
    // Clean up uploaded file
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});

// GET /transcribe
app.get("/transcribe", async (req, res) => {
  const userId = req.headers["x-user-id"] || null;
  if (!mongoConnected) {
    console.warn("GET /transcribe requested but MongoDB not connected. Returning local history.");
    const local = await readLocalDB();
    // Filter by userId if present
    const filtered = userId ? local.filter((t) => t.userId === userId) : local;
    return res.json(filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }
  const history = userId
    ? await Transcription.find({ userId }).sort({ createdAt: -1 })
    : await Transcription.find().sort({ createdAt: -1 });
  res.json(history);
});

// DELETE /transcribe/:id
app.delete("/transcribe/:id", async (req, res) => {
  const userId = req.headers["x-user-id"] || null;
  if (!mongoConnected) {
    console.warn("DELETE /transcribe requested but MongoDB not connected. Using local store.");
    const list = await readLocalDB();
    const filtered = userId
      ? list.filter((t) => t._id !== req.params.id || t.userId !== userId)
      : list.filter((t) => t._id !== req.params.id);
    await writeLocalDB(filtered);
    return res.json({ success: true });
  }
  if (userId) {
    await Transcription.deleteOne({ _id: req.params.id, userId });
  } else {
    await Transcription.findByIdAndDelete(req.params.id);
  }
  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
