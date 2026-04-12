#!/usr/bin/env python3
"""
Tiny TTS server using edge-tts (Microsoft Edge neural voices).
Listens on port 5190, returns WAV audio for any text.

Usage:
    python3 tts-server.py
    # or with the venv:
    /tmp/tts-env/bin/python tts-server.py

API:
    POST /tts  { "text": "Hello world" }
    Returns: audio/wav binary
"""

import asyncio
import io
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

VOICE = "en-US-AriaNeural"  # Female voice
PORT = 5190


class TTSHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/tts":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            text = data.get("text", "")

            if not text:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing text")
                return

            # Generate audio
            audio_bytes = asyncio.run(generate_audio(text))

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(audio_bytes)))
            self.end_headers()
            self.wfile.write(audio_bytes)
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[TTS] {args[0]}")


async def generate_audio(text):
    import edge_tts
    communicate = edge_tts.Communicate(text, VOICE)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data


if __name__ == "__main__":
    print(f"TTS server starting on http://localhost:{PORT}")
    print(f"Voice: {VOICE}")
    server = HTTPServer(("0.0.0.0", PORT), TTSHandler)
    server.serve_forever()
