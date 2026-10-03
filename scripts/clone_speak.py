import sys
import torch
import soundfile as sf
import torchaudio

# torchaudio >= 2.9 routes load() through torchcodec (which needs system FFmpeg).
# Route it through soundfile instead so no FFmpeg install is needed.
def _load_with_soundfile(filepath, *args, **kwargs):
    data, sr = sf.read(str(filepath), dtype="float32", always_2d=True)
    return torch.from_numpy(data.T.copy()), sr
torchaudio.load = _load_with_soundfile

from TTS.api import TTS

text = sys.argv[1]
speaker_wav = sys.argv[2]
out_path = sys.argv[3]
language = sys.argv[4] if len(sys.argv) > 4 else "en"

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
tts.tts_to_file(text=text, speaker_wav=speaker_wav, language=language, file_path=out_path)
print("DONE:", out_path)
