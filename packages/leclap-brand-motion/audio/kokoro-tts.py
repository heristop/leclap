"""Batch text-to-speech with Kokoro-82M (via kokoro-onnx), for audio/generate-voice.ts.

Reads one JSON job on stdin:
  {"model": "...onnx", "voices": "...bin", "voice": "af_heart", "lang": "en-us",
   "lines": [{"id": "vo-01", "text": "...", "speed": 1.0, "out": "/path/vo-01.wav"}, ...]}

Writes each line as a 24 kHz mono WAV and prints one JSON result per line ({"id", "seconds"}).
`[[slnc N]]` markers (the macOS `say` pause syntax the voice script already uses) become N ms of
silence, so the same script drives both engines. The model loads once for the whole batch.
"""

import json
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

PAUSE = re.compile(r"\[\[slnc (\d+)\]\]")


def synthesize(kokoro: Kokoro, text: str, voice: str, speed: float, lang: str) -> tuple[np.ndarray, int]:
    parts = PAUSE.split(text)
    chunks: list[np.ndarray] = []
    rate = 24000

    for index, part in enumerate(parts):
        if index % 2 == 1:
            chunks.append(np.zeros(int(rate * int(part) / 1000), dtype=np.float32))
            continue

        spoken = part.strip()

        if not spoken:
            continue

        samples, rate = kokoro.create(spoken, voice=voice, speed=speed, lang=lang)
        chunks.append(samples.astype(np.float32))

    if not chunks:
        return np.zeros(1, dtype=np.float32), rate

    return np.concatenate(chunks), rate


def main() -> None:
    job = json.load(sys.stdin)
    kokoro = Kokoro(job["model"], job["voices"])

    for line in job["lines"]:
        voice = line.get("voice", job["voice"])
        audio, rate = synthesize(kokoro, line["text"], voice, float(line.get("speed", 1.0)), job.get("lang", "en-us"))
        sf.write(line["out"], audio, rate)
        print(json.dumps({"id": line["id"], "seconds": round(len(audio) / rate, 3)}), flush=True)


if __name__ == "__main__":
    main()
