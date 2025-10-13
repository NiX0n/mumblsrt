<!-- Improved compatibility of back to top link: See: https://github.com/NiX0n/mumblsrt/pull/73 -->
<a id="readme-top"></a>
<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->



<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License: MIT][license-shield]][license-url]


<!-- PROJECT LOGO -->
<br />
<div align="center">
  <!--a href="https://github.com/NiX0n/mumblsrt">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a-->

  <h1 align="center">Mumblsrt</h1>

  <p align="center">
    A subtitle generation tool that leverages and overcomes limitations of Whisper.cpp.
    <br />
    <a href="https://github.com/NiX0n/mumblsrt"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/NiX0n/mumblsrt">View Demo</a>
    &middot;
    <a href="https://github.com/NiX0n/mumblsrt/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/NiX0n/mumblsrt/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About Mumblsrt</a>
      <ul>
        <li><a href="#nethodology">Methodology</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#configuration">Configuration</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About Mumblsrt

Mumblsrt is a [NodeJS][NodeJS-url] utility for generating [SRT files][srt-url] for temporally large media using [Whisper.cpp][whispercpp-url]--which leverages OpenAI's WhisperAI models.  We're also leveraging [ffmpeg][ffmpeg-url] which allows us to generate subtitles for any of its vast supported media types (audio or video).

This project is perfect for transcribing:
 * VHS rips
 * Long audio tracks
 * Any media that doesn't already have subtitles
 * In theory, also translating foreign languages (untested)


Specifically, we're leveraging Whisper.cpp's Command Line Interface (CLI).  This tool on its own can technically generate SRT files using the `-osrt` option, but _ALL_ Whisper models have a distinct hallucinatory failure mode on long stretches of audio.

**Tip:** If you are looking to make subtitles on audio tracks less than 10 minutes or so, you're probably better off just using Whisper.cpp on its own without Mumblsrt.


<p align="right">(<a href="#readme-top">back to top</a>)</p>


### Methodology
The name "mumblsrt" comes from the fact that Whisper tends to "mumble" or "stutter"&mdash;repeating words, phrases, and unspoken characters&mdash;particularly on long stretches of time.  It is believed that this is caused by Whisper's attention context windows becoming saturated, and effectively loses attention altogether.  Sometimes Whisper is able to recover after a long series a failure.  We will try to use whatever transcriptions that aren't problematic.

We can overcome the tehnical limitations of Whisper by making some basic assumptions:
1. Whisper will get at least something (ustually the beginning), if not most/all right on most attempts
2. We can identify when it's wrong using statistical analysis

Given these assumptions, we can work around the problem we identify in #2 by repeatedly force feeding Whisper subsequently shorter chunks of audio by "dividing and conquering" the whole audio track.

Specifically we take an iterative depth-first tree recursion approach.  On the first root level of the recursion tree, our first attempt, we try to transcribe the entire input file.  On each recursion attempt:
1. Instead of generating a subtitle file directly, we let ffmpeg+Whisper.cpp generate machine-readable JSON files.
2. We ingest those transcription JSON files into a SQLite database that we can run relatively more complex queries.
3. If for some reason we've recursed to some limit (default: 9 levels deep), we'll just settle with whatever we have at that level.
4. We identify any suspect transciption timestamp ranges, and deactivate them so they are ignored in the final output.
5. Each of the contiguous ranges becomes the definition of a new Whisper attempt; and we recurse to step #1, processing between only the respective timestamps.

It's worth noting that we are piping a copy the output of ffmpeg to a local `*.wav` file for the purposes of efficient reuse and slicing.  This cached `*.wav` file is used on subsequent attempts without touching the original file again.

There are two major classes of failure modes:
1. Stuttering
2. Zero-Length Transcriptions

#### "Stutter" Detection
There are three sub-classes of what we're calling "stuttering"
1. Intra-trascription stuttering.  Where a word or phrase is repeated numerous times within a single transcription.
2. Short inter-trascription stuttering.  Where one identical transcription is repeted continuuously.
3. Long inter-trascription stuttering.  Where larger sets of transcriptions are repeated in groups.

These "stutterings" will repeat for long stretches of time.  Sometimes Whisper will recover after a period of failure.  Internally, Whisper's confidence scpres of its assertions are not indicative on their own of an issue.  In fact, some repeteated tramscriptions counter-intuitively have progressively higher confidence scores.

The method we use to detect stutterings by calculating the average/mean count of each word (contiguous non-whitespace) over a sliding window function.  The sliding window is a contiguous range of transcriptions of variable count (1, 3, 5, and 7).  If at any of those window sizes, the average word count is greater than 2, we will consider it a stutter and will flag that range as **SUSPECT** (`is_suspect=true`).

#### Zero-Length Detection
The other less prominent failure mode presents itself as transcriptions with zero length&mdash;as in, the timestamps have zero time between them.  This is basic comparison/arithmetic to query for.  However, what is tricky is that its also accompanied by a "driftinng" behavior, where transcriptions lose syncronization with respective speech.  We're using a bit of a hacky work around, and marking the surrounding minute (both ±) of transcriptions as **SUSPECT** (`is_suspect=1`).

#### Suspect Ranges
Once all suspect transcriptions have been marked (`is_suspect=1`), they will be fully deactivated (`is_active=0`) which will cause them to be ignored in the final output SRT file.  Then the (notably finite) list of contiguous ranges become the definitions for subsequent recursion attempts.  This effectively means that subsequent recursions will attempt to transcribe only between each of the suspect range's timestamps.

**Notice:** If we have already hit recursion limit, we would have stopped at that depth prior to suspect transcription identification.  This is what prevents infinite recursion, and a means of always having something transcribed.  This recursion limiting also allows false-positives to eventually pass though.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started
Before you can run Mumblsrt, you first have to get a few things set up.

### Prerequisites
You will need to have the following installed and/or compiled on your system:
 * [NodeJS][NodeJS-url] v23+
 * [ffmpeg][ffmpeg-url] v6+
 * [Whisper.cpp][whispercpp-url] V1.7+
 
#### NodeJS & ffmpeg
We assume you've installed (i.e. via OS package manager, etc.) these two executables separately and that the respective executable binaries are visible via the $PATH environment variable.  If this is not the case, then some code modification may be required.

#### Whisper.cpp
Check out and compile Whisper.cpp by following the [directions in their own README][whispercpp-url].  Take note of any hardware acceleration compile-time options you might want to leverage (i.e. `-DGGML_CUDA=1` or `-DGGML_VULKAN=1`), as these drastically improve performance over CPU-only transcription.

You will also need to follow the instructions on how to download and install the model you want to use.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Installation

Once you have the prerequisites installed, you can proceed with using mumblsrt.

1. Clone the repo
   ```sh
   git clone https://github.com/NiX0n/mumblsrt.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. If necessary, update `config.js` to meet your system's specifications (see: <a href="#configuration">Configuration</a>).  

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

Once mumblsrt is installed an configured, you run it using the following syntax:

```sh
./run.sh "/path/to/media.mp4"
```

Using the default configuaration, this will ultimately generate a subtitle file in the same directory and filename as the input media, with a replaced extension: `.mumbl.srt`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Garbage Collection
The default configuration uses a local `tmp` working directory (see <a href="#wd">wd configuration</a>).  The current version of this package doesn't do its own garbage collection, so you are responsible for the construction and deletion of the `tmp` directory, before and after use respectively.  There is no consequence for not deleting, except wasted space.

```sh
# before ./run.sh
mkdir tmp

# after ./run.sh
rm -rf tmp
```

Notice: It may be useful to inspect the internal SQLite database for dianostic purposes before deleting your work.  For example, after transcribing, you can see more detail by running:
```sh
sqlite3 tmp/db.sqlite3
```


## Configuration
The `config.js` file stores various settings.  The copy that comes with this repository already has some sane defaults.  It's recommended that you investigate your own system specifications for proper tuning of these settings.  Notably, this is the place to define and override arguments passed to ffmpeg and whisper-cli (see <a href="#scribeoptions">scribe.options</a> for detail).

### wd
*Signature:* `wd: {string}` 

This the Working Directory where all of our temporary filee (SQLite DB, WAV file cache, transcription JSON output files, etc.) are located.

### maxRecursion
*Signature:* `wd: {integer}` 

This the maximum recursion depth we're allowed to descend before giving up.  

*Notice:* While there is a `maxRecursion` limit, there is no similar `maxAttempt`-like limit, as the breadth of the recursion tree is always finite.

### scribe.srtFileTransform
*Signature:* `scribe.srtFileTransform: {function (file): string}`

Transforms the input filename to the output srt's.

### scribe.model
*Signature:* `scribe.model: {string}`

Defines the path (relative to Whisper.cpp's base directory) to the OpenAI WhisperAI model you're going to use (that you downloaded after compiling Whisper.cpp).

**Tip:** Larger models take longer to process transcriptions, but tend to do a better job.  No model is free from errors though.

### scribe.options
*Signature:* `scribe.options: {object}`

These are command arguments passed to either [ffmpeg][ffmpeg-url] or [whisper-cli][whispercli-url].  The expected argument names are mutually exclusive from one another, so both sets of arguments are supported as keys of this object.  Refer to their respective help pages for guidance on what options do what.  Most defaults won't need changing though.

**Tip:** Take note of the number of available threads your machine has.  For example, set `options: {t: 20}` for 20 available threads.

#### Notable Whisper CLI Options 
| Name |  Type   | Description |
|:----:|:-------:|-------------|
|  p   | integer | # of processes/equal chunks Whisper will divide on its own |
|  t   | integer | # of threads to use per process |
|  bo  | integer | Transcription "best of" guess consensus |
|  bs  | integer | Beam size. Use higher values for noisy or multiple voices |
|  nf  | boolean | No temperature fallback.  When false, gets more *creative* in low-confidence envionments. |
|  nth | float   | No speech threshold |
|  ml  | integer | Maximum segment length in characters |
|  tp  | float   | Temperature, amount of entropy used for creative choices. |
| "-prompt" | string | Optionl string that represents the expected style of transcription |

(See: [whisper-cli usage][whispercli-url] for more)


### scribe.depthOptions
*Signature:* `scribe.depthOptions: {object<string, object>}`

Sometimes it is useful to have overriding options (see <a href="#scribeoptions">scribe.options</a>) at different recursion depths.  For example, on the first depth level, you may want to use the `p` whisper-cli option to safely sub-divide the track into more manageable chunks of known equal size.

You may also want to choose to set more exotic options for larger depths to encourage diversity in approach when in a high failure state.

### scribe.promotFile
*Signature:* `scribe.promotFile: {string}`

This is a filename whose contents will be passed as a `--prompt` option to whisper-cli (See <a href="#notable-whisper-cli-options">"-prompt" in options</a>).

### scribe.execOptions
*Signature:* `scribe.execOptions: {object<string, any>}`

Options passed to [child_process.exec()](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback).  Notably, this has `cwd` set to Whisper.cpp base directory.

### db.path
*Signature:* `db.path: {string}`

This is the `path` argument passed to the [SQLite DatabaseSync conststructor](https://nodejs.org/api/sqlite.html#class-databasesync).  The sane place is to leave it in the `wd`.  It's technically possible to run the database in `:memory:`; but it's not recommended, as the performance gain is very limited, and the application is designed to be able to pick up from previous failures/interruptions.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Add back to top links
- [ ] Add Changelog
- [ ] Add more details on stats
- [ ] Add garbage collection

See the [open issues](https://github.com/NiX0n/mumblsrt/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the [MIT License][license-url].

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Project Link: [https://github.com/NiX0n/mumblsrt][repo-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments
A special thanks to:

* [Best-README-Template][Best-README-url], for this very useful README.md template.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[repo-url]: https://github.com/NiX0n/mumblsrt/
[contributors-shield]: https://img.shields.io/github/contributors/NiX0n/mumblsrt.svg?style=for-the-badge
[contributors-url]: https://github.com/NiX0n/mumblsrt/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/NiX0n/mumblsrt.svg?style=for-the-badge
[forks-url]: https://github.com/NiX0n/mumblsrt/network/members
[stars-shield]: https://img.shields.io/github/stars/NiX0n/mumblsrt.svg?style=for-the-badge
[stars-url]: https://github.com/NiX0n/mumblsrt/stargazers
[issues-shield]: https://img.shields.io/github/issues/NiX0n/mumblsrt.svg?style=for-the-badge
[issues-url]: https://github.com/NiX0n/mumblsrt/issues
[license-shield]: https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge
[license-url]: https://opensource.org/licenses/MIT
[whispercpp]: https://img.shields.io/badge/C++-Whisper.cpp-blue
[whispercpp-url]: https://github.com/ggml-org/whisper.cpp
[whispercli-url]: https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md
[ffpmeg]: https://shields.io/badge/FFmpeg-%23171717.svg?logo=ffmpeg&style=for-the-badge&labelColor=171717&logoColor=5cb85c
[ffmpeg-url]: https://ffmpeg.org/ffmpeg.html
[srt-url]: https://en.wikipedia.org/wiki/SubRip
[SQLite-url]: https://sqlite.org/
[NodeJS-url]: https://nodejs.org/
[NodeJS]: https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white
[Best-README-url]: https://github.com/othneildrew/Best-README-Template 
