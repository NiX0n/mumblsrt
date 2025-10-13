# Compiling Whisper.cpp
Specific to Ubuntu 24.04, as of 2025/10/01.

I had problems with the 1.8.0 release.  It may be resolved by the time of reading.  After rolling back to this specific revision of Whisper.cpp, compile was successful.

## Install dependencies
```sh
# For Vulkan
sudo apt install cmake build-essential glslc glslang-tools \
    libvulkan-dev vulkan-tools libvulkan1 spirv-tools vulkan-headers=1.3.275*
    
# For real-time transcription
sudo apt install libsdl2-dev
```

## Download Whisper.cpp Source
```sh
mkdir -p ~/src
cd src/
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
# This is the working version.  Newer v1.8.0+ untested/broken
git checkout c09b0e0c
```

## Compile Whisper.cpp
```sh
# SDL enables real-time
cmake -B build \ 
    -DGGML_VULKAN=1 \
	-DWHISPER_SDL2=ON
cmake --build build -j --config Release
```

## Download Model
See Whisper.cpp's [available models](https://github.com/ggml-org/whisper.cpp/blob/master/README.md#more-audio-samples).  Replace `large-v3-turbo` with your model of choice.
```sh
./models/download-ggml-model.sh large-v3-turbo
```


## Test
### Compiled Binaries
```sh
./build/bin/whisper-cli --help
./build/bin/whisper-stream --help
```

### Simple SRT file generation
```sh
ffmpeg -i "/path/to/media.avi" -f "wav" -acodec "pcm_s16le" -ac 1 -ar 16000 - \
	| ./build/bin/whisper-cli \
		-t 20 -bo 7 -bs 7 -nf -nth 0.2 -ml 200 \
		-m "./models/ggml-large-v3-turbo.bin" \
		-osrt -of "/path/to/media" -f -
```
