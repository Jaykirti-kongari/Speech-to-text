# Speech to Text App (MERN + ElevenLabs)

A full-stack application that lets users record or upload audio, transcribe it to text using ElevenLabs Speech-to-Text API, and store/retrieve transcriptions from MongoDB. Built with React, Node.js, Express, MongoDB, and Tailwind CSS.

---

## Features
- 🎤 Record or upload audio files
- 📝 Transcribe audio to text (ElevenLabs API)
- 🗃️ Save and view transcription history (MongoDB)
- 🖥️ Modern UI with React + Tailwind CSS
- 🔒 (Optional) User authentication with Supabase

---

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Speech-to-Text:** ElevenLabs API
- **(Optional):** Supabase Auth

---

## Getting Started

### 1. Clone the repository
```sh
git clone <your-repo-url>
cd whisper-voice-notes
```

### 2. Install dependencies
```sh
npm install
cd backend
npm install
```

### 3. Environment Variables
- Copy `.env.example` to `.env` in both root and backend folders (if provided).
- Set these variables in `backend/.env`:
  ```env
  ELEVENLABS_API_KEY=your_elevenlabs_key_with_stt_permission
  MONGODB_URI=your_mongodb_connection_string
  # (Optional) Supabase keys if using auth
  ```

### 4. Start the app (Development)
- **Backend:**
  ```sh
  cd backend
  npm start
  ```
- **Frontend:**
  ```sh
  npm run dev
  ```
- Visit [http://localhost:8080](http://localhost:8080)

### 5. Build for Production
```sh
npm run build
```
- Deploy the `dist/` folder to Netlify, Vercel, or any static host.
- Deploy the backend to Render, Vercel, or Heroku.

---

## Deployment
- **Frontend:** Deploy `dist/` to Netlify, Vercel, etc.
- **Backend:** Deploy `backend/` to Render, Vercel, or Heroku.
- Update API URLs in frontend if deploying to different domains.

---

## Troubleshooting
- **401 Unauthorized (ElevenLabs):**
  - Make sure your API key has Speech-to-Text permission.
- **MongoDB connection errors:**
  - Check your `MONGODB_URI` and network/firewall settings.
- **CORS issues:**
  - Ensure backend allows requests from your frontend domain.

---

## Resources
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Supabase](https://supabase.com/)

---

## License
MIT

---

## Author
- Your Name (update this!)
