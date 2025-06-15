import { useRef, useState } from "react";

export interface FfmpegConvertState {
  loading: boolean;
  progress: number;
  error: string | null;
  outputUrl: string | null;
}

export function useFfmpegConvert() {
  const ffmpegRef = useRef<any>(null); // We don't know the module shape until import
  const [state, setState] = useState<FfmpegConvertState>({
    loading: false,
    progress: 0,
    error: null,
    outputUrl: null,
  });

  // Main conversion function
  const convertWebmToMp4 = async (inputBlob: Blob) => {
    setState({
      loading: true,
      progress: 0,
      error: null,
      outputUrl: null,
    });

    // Correct dynamic import handling for ESM/CJS.
    const ffmpegModule = await import("@ffmpeg/ffmpeg");

    // Support both ESM and CJS shapes
    const createFFmpeg =
      (ffmpegModule as any).createFFmpeg ||
      (ffmpegModule as any).default?.createFFmpeg;
    const fetchFile =
      (ffmpegModule as any).fetchFile ||
      (ffmpegModule as any).default?.fetchFile;

    if (!createFFmpeg || !fetchFile) {
      setState({
        loading: false,
        progress: 0,
        error: "Could not load FFmpeg methods. Please check the build environment.",
        outputUrl: null,
      });
      return null;
    }

    if (!ffmpegRef.current) {
      ffmpegRef.current = createFFmpeg({ log: true }); // Turn on FFmpeg logs
    }
    const ffmpeg = ffmpegRef.current;

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    ffmpeg.setProgress(({ ratio }: { ratio: number }) => {
      setState(prev => ({
        ...prev,
        progress: Math.round(ratio * 100),
      }));
    });

    try {
      // Write input file
      ffmpeg.FS('writeFile', 'input.webm', await fetchFile(inputBlob));

      // --- Key WhatsApp-friendly command: ---
      // - shorter/standardized, only basic flags
      // - important to produce baseline H.264/AAC @ correct audio specs
      await ffmpeg.run(
        "-i", "input.webm",
        // Video
        "-c:v", "libx264",
        "-profile:v", "baseline",
        "-level", "3.0",
        "-pix_fmt", "yuv420p",
        "-preset", "veryfast",
        "-r", "30", // Force 30 fps for compatibility
        // Audio
        "-c:a", "aac",
        "-ac", "2",                 // Stereo
        "-ar", "44100",             // Audio sample rate WhatsApp expects
        "-b:a", "128k",             // Audio bitrate
        // Container
        "-movflags", "+faststart",  // Place moov atom at start
        "output.mp4"
      );

      // Read the result
      const data = ffmpeg.FS("readFile", "output.mp4");
      // Use Uint8Array to ensure MP4 file compatibility
      const mp4Blob = new Blob([new Uint8Array(data)], { type: "video/mp4" });
      const outputUrl = URL.createObjectURL(mp4Blob);

      // Log debug info
      console.log("[FFMPEG] Output MP4 size:", mp4Blob.size, "bytes");

      setState({
        loading: false,
        progress: 100,
        error: null,
        outputUrl,
      });

      // Clean up files in the FS to avoid memory leaks
      ffmpeg.FS("unlink", "input.webm");
      ffmpeg.FS("unlink", "output.mp4");

      return outputUrl;
    } catch (err: any) {
      setState({
        loading: false,
        progress: 0,
        error: (err && err.message) || "FFmpeg conversion failed",
        outputUrl: null,
      });
      // Log error for debugging
      console.error("FFmpeg conversion error:", err);
      return null;
    }
  };

  // Clean up object URLs
  const cleanUp = () => {
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
    }
    setState({
      loading: false,
      progress: 0,
      error: null,
      outputUrl: null,
    });
  };

  return {
    ...state,
    convertWebmToMp4,
    cleanUp,
  };
}
