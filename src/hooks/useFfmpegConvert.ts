
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
      ffmpegRef.current = createFFmpeg({ log: false });
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

      // Run the conversion command with settings for high compatibility (e.g., for WhatsApp)
      await ffmpeg.run(
        "-i", "input.webm",          // Input file
        "-c:v", "libx264",            // Video codec: H.264
        "-profile:v", "baseline",     // H.264 profile for broad compatibility
        "-level", "3.0",              // H.264 level
        "-preset", "medium",          // Encoding speed vs. compression balance
        "-crf", "23",                 // Constant Rate Factor for quality (lower is better)
        "-c:a", "aac",                // Audio codec: AAC
        "-b:a", "128k",               // Audio bitrate
        "-movflags", "+faststart",    // Move metadata to the start for faster playback
        "-pix_fmt", "yuv420p",        // Pixel format for maximum compatibility
        "output.mp4"                  // Output file
      );

      // Read the result
      const data = ffmpeg.FS("readFile", "output.mp4");
      const mp4Blob = new Blob([data.buffer], { type: "video/mp4" });
      const outputUrl = URL.createObjectURL(mp4Blob);

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
