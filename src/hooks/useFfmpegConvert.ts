
import { useRef, useState } from "react";

export interface FfmpegConvertState {
  loading: boolean;
  progress: number;
  error: string | null;
  outputUrl: string | null;
}

export function useFfmpegConvert() {
  const ffmpegRef = useRef<any>(null); // FFmpeg WebAssembly module instance
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

    // Dynamic import of FFmpeg
    const ffmpegModule = await import("@ffmpeg/ffmpeg");

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
      ffmpegRef.current = createFFmpeg({
        log: true,
        logger: ({ type, message }: { type: string; message: string }) => {
          // Forward ffmpeg logs to browser console for debugging
          console.log(`[FFMPEG] [${type}] ${message}`);
        },
      });
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
      ffmpeg.FS('writeFile', 'input.webm', await fetchFile(inputBlob));

      // SIMPLIFIED, STRICT MP4/WhatsApp FRIENDLY COMMAND:
      await ffmpeg.run(
        "-fflags", "+genpts",
        "-i", "input.webm",
        "-c:v", "libx264",
        "-profile:v", "baseline",
        "-level", "3.0",
        "-preset", "veryfast",
        "-r", "30",
        "-b:v", "2000k",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-ar", "44100",
        "-movflags", "+faststart",
        "output.mp4"
      );

      // Debug: check output file metadata
      try {
        const ffprobeOut = await ffmpeg.run(
          "-i", "output.mp4",
          "-hide_banner"
        );
        console.log("[FFMPEG] Output MP4 ffprobe:", ffprobeOut);
      } catch (probeError) {
        console.warn("[FFMPEG] ffprobe failed", probeError);
      }

      const data = ffmpeg.FS("readFile", "output.mp4");
      const mp4Blob = new Blob([new Uint8Array(data)], { type: "video/mp4" });
      const outputUrl = URL.createObjectURL(mp4Blob);

      console.log("[FFMPEG] Output MP4 size:", mp4Blob.size, "bytes");

      setState({
        loading: false,
        progress: 100,
        error: null,
        outputUrl,
      });

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

