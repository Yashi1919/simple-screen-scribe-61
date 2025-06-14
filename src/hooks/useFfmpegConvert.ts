
import { useRef, useState } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

export interface FfmpegConvertState {
  loading: boolean;
  progress: number;
  error: string | null;
  outputUrl: string | null;
}

export function useFfmpegConvert() {
  const ffmpegRef = useRef<ReturnType<typeof createFFmpeg> | null>(null);
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

    if (!ffmpegRef.current) {
      ffmpegRef.current = createFFmpeg({ log: false, corePath: undefined });
    }
    const ffmpeg = ffmpegRef.current;

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    ffmpeg.setProgress(({ ratio }) => {
      setState(prev => ({
        ...prev,
        progress: Math.round(ratio * 100),
      }));
    });

    try {
      // Write input file
      ffmpeg.FS('writeFile', 'input.webm', await fetchFile(inputBlob));

      // Run the conversion command
      await ffmpeg.run(
        "-i", "input.webm",
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "aac",
        "-movflags", "faststart",
        "-pix_fmt", "yuv420p",
        "output.mp4"
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
