# Whisper-CLI Options Detailed
Below are the options that can be passed into `./build/bin/whisper-cli`, and is a little more verbose on detail over [what's in the --help](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md).

### Core Input/Output Options
- **`-f, --file <filename>`**  
  Path to the audio file you want to transcribe. Supports formats like WAV, MP3, FLAC, etc. This is the main input.

- **`-otxt, --output-txt`**  
  Save transcription as a plain `.txt` file. Useful if you just want raw text.

- **`-osrt, --output-srt`**  
  Save transcription as `.srt` subtitles (SubRip format). Widely supported in video players/editors.

- **`-of, --output-file <name>`**  
  Base name for output files. By default, it uses the input filename stem.

---

### Model and Performance Options
- **`-m, --model <filename>`**  
  Path to the Whisper model file (`.bin`). Different models vary in size and accuracy (tiny, base, small, medium, large).

- **`-t, --threads <n>`**  
  Number of CPU threads to use. More threads = faster transcription, but higher CPU load.

- **`-p, --processors <n>`**  
  Number of processors (or cores) to use. Useful for multi-core systems.

- **`-ng, --no-gpu`**  
  Disable GPU acceleration, forcing CPU-only inference. Slower, but avoids GPU memory issues.

- **`-ml, --max-len <n>`**  
  Maximum segment length in characters. Prevents overly long segments.

- **`-mc, --max-context <n>`**  
  Maximum context tokens to carry over between segments. Larger context improves coherence but uses more memory.

---

### Language and Translation
- **`-l, --language <lang>`**  
  Set the spoken language of the input audio (e.g., `en`, `es`, `fr`). If omitted, Whisper tries to auto-detect.

- **`-tr, --translate`**  
  Instead of transcribing, translate non-English speech into English.

---

### Decoding and Accuracy Controls
- **`-sow, --split-on-word`**  
  Split segments on word boundaries rather than arbitrary token boundaries. Improves readability.

- **`-su, --speed-up`**  
  Enable a faster, approximate decoding mode. Sacrifices some accuracy for speed.

- **`-bs, --beam-size <n>`**  
  Beam search size. Larger beams improve accuracy but slow down decoding.

- **`-wt, --word-thold <n>`**  
  Confidence threshold for word timestamps. Filters out uncertain alignments.

- **`-et, --entropy-thold <n>`**  
  Entropy threshold for pruning low-confidence tokens.

- **`-lpt, --logprob-thold <n>`**  
  Log probability threshold for discarding unlikely tokens.

---

### Advanced / Debugging
- **`-pp, --print-progress`**  
  Print progress updates during transcription.

- **`-ps, --print-special`**  
  Print special tokens (like `[MUSIC]`, `[APPLAUSE]`). Useful for debugging or detailed transcripts.

- **`-pc, --print-colors`**  
  Colorize output in the terminal for readability.

- **`-nt, --no-timestamps`**  
  Suppress timestamps in the output. Produces plain text only.

- **`-debug`**  
  Print extra debug information about the decoding process.

---

## Input Control
- **`-ot N, --offset-t N`**  
  Start processing at a given time offset (milliseconds). Useful if you want to skip an intro or resume from a specific point in a long file.

- **`-on N, --offset-n N`**  
  Start processing at a given *segment index* rather than time. Segments are Whisper’s internal chunks of audio. Handy for resuming from a known segment.

- **`-d N, --duration N`**  
  Limit transcription to a fixed duration (milliseconds). Lets you process only a slice of the audio.

---

## Decoding Strategy
- **`-bo N, --best-of N`**  
  When using sampling, keep the top-N candidates and choose the best. Higher = more accurate but slower.

- **`-bs N, --beam-size N`**  
  Beam search size. Larger beams explore more possibilities, improving accuracy at the cost of speed.

- **`-ac N, --audio-ctx N`**  
  Audio context window size. `0` means use the full context. Smaller values reduce memory use but may hurt accuracy.

- **`-nth N, --no-speech-thold N`**  
  Probability threshold for classifying a segment as “no speech.” Higher = more aggressive at discarding silence/noise.

- **`-tp N, --temperature N`**  
  Sampling temperature (0–1). Low = deterministic, high = more diverse/creative outputs. For transcription, usually kept low.

- **`-tpi N, --temperature-inc N`**  
  If decoding fails, Whisper can retry with gradually higher temperatures. This sets the increment.

- **`-nf, --no-fallback`**  
  Disable the above temperature fallback mechanism. If decoding fails, it won’t retry with higher temps.

---

## Special Features
- **`-tr, --translate`**  
  Translate non-English speech into English instead of transcribing verbatim.

- **`-di, --diarize`**  
  Stereo diarization: tries to separate speakers if each channel corresponds to a different person.

- **`-tdrz, --tinydiarize`**  
  Enables “tinydiarize” (requires a separate diarization model). More advanced speaker separation.

- **`-dtw MODEL, --dtw MODEL`**  
  Compute token-level timestamps using a DTW (Dynamic Time Warping) alignment model. Gives very fine-grained timing.

---

## Output Formats

- **`-ovtt, --output-vtt`**  
  Save transcription as a `.vtt` subtitle file (WebVTT format). Handy for embedding captions in web video players.

- **`-olrc, --output-lrc`**  
  Save output as `.lrc` (lyrics file format, often used for karaoke).

- **`-owts, --output-words`**  
  Output a script suitable for generating karaoke-style videos with word-level timing.

- **`-fp, --font-path`**  
  Path to a monospace font used for karaoke rendering.

- **`-ocsv, --output-csv`**  
  Save results as CSV (segments, timestamps, text).

- **`-owts, --output-words`**  
  Output word-level timestamps. This is more detailed than segment-level timestamps and useful for precise alignment.

- **`-oj, --output-json`**  
  Save results as JSON (structured, machine-readable).

- **`-ojf, --output-json-full`**  
  Extended JSON with more metadata (token-level info, probabilities, etc.).

---

## Runtime / Debugging
- **`-np, --no-prints`**  
  Suppress all console output except the final results.

- **`-dl, --detect-language`**  
  Detect language and exit immediately (no transcription). Useful for language ID tasks.

- **`--prompt PROMPT`**  
  Provide an initial text prompt to bias decoding. Helps with context-specific vocabulary or style.

- **`-oved D, --ov-e-device DNAME`**  
  Select OpenVINO device for encoder inference (e.g., `CPU`, `GPU`). Relevant if using Intel’s OpenVINO backend.

- **`-ls, --log-score`**  
  Log best decoder scores for tokens. Debugging/analysis feature.

- **`-debug, --debug-mode`**  
  Enable debug mode (e.g., dump intermediate log-mel spectrograms).

---

## Hardware / Performance
- **`-ng, --no-gpu`**  
  Force CPU-only inference, even if GPU is available.

- **`-fa, --flash-attn`**  
  Enable FlashAttention (optimized attention kernel). Can speed up inference on supported hardware.

---

## Token Filtering & Grammar
- **`-sns, --suppress-nst`**  
  Suppress non-speech tokens (like `[MUSIC]`, `[APPLAUSE]`).

- **`--suppress-regex REGEX`**  
  Provide a regex to suppress tokens matching a pattern. Useful for filtering unwanted words.

- **`--grammar GRAMMAR`**  
  Supply a GBNF grammar file to constrain decoding. This can force outputs to follow a structured format (e.g., JSON, commands).

- **`--grammar-rule RULE`**  
  Specify the top-level rule in the grammar to use.

- **`--grammar-penalty N`**  
  Penalize tokens not matching the grammar. Higher = stricter adherence.

---

### Practical Example
```bash
./build/bin/whisper-cli \
  -f interview.mp3 \
  -m models/ggml-base.en.bin \
  -l en \
  -t 8 \
  -osrt -ovtt \
  -pp -pc
```
This command:  
- Transcribes `interview.mp3` in English  
- Uses the `base.en` model with 8 threads  
- Outputs both `.srt` and `.vtt` subtitle files  
- Prints progress and uses colored terminal output  

