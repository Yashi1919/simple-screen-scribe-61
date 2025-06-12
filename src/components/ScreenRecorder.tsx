
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, StopCircle, Download } from "lucide-react";
import { toast } from "sonner";

type VideoFormat = 'webm' | 'mp4' | 'wav';

interface FormatOption {
  value: VideoFormat;
  label: string;
  mimeType: string;
  extension: string;
}

const formatOptions: FormatOption[] = [
  { value: 'webm', label: 'WebM Video', mimeType: 'video/webm; codecs=vp9', extension: 'webm' },
  { value: 'mp4', label: 'MP4 Video', mimeType: 'video/mp4', extension: 'mp4' },
  { value: 'wav', label: 'WAV Audio Only', mimeType: 'audio/wav', extension: 'wav' },
];

const ScreenRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat>('webm');
  
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const recordedVideoRef = useRef<HTMLVideoElement>(null);

  // Check browser compatibility
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast.error("Your browser doesn't support screen recording");
    }
  }, []);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  const getSelectedFormatOption = () => {
    return formatOptions.find(option => option.value === selectedFormat) || formatOptions[0];
  };

  const startRecording = async () => {
    try {
      const formatOption = getSelectedFormatOption();
      
      // Get screen capture stream
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: selectedFormat !== 'wav' ? { 
          displaySurface: "monitor",
        } : false,
        audio: true,
      });
      
      setStream(displayStream);

      // Display live preview (only for video formats)
      if (liveVideoRef.current && selectedFormat !== 'wav') {
        liveVideoRef.current.srcObject = displayStream;
      }

      // Set up media recorder with selected format
      let mimeType = formatOption.mimeType;
      
      // Fallback MIME types if the selected one isn't supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (selectedFormat === 'mp4') {
          mimeType = 'video/webm; codecs=vp9'; // Fallback to WebM for MP4
          toast.info("MP4 not supported, using WebM format instead");
        } else if (selectedFormat === 'wav') {
          mimeType = 'audio/webm; codecs=opus'; // Fallback for audio
          toast.info("WAV not supported, using WebM audio format instead");
        }
      }

      const recorder = new MediaRecorder(displayStream, { mimeType });
      setMediaRecorder(recorder);
      
      // Store recorded chunks
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          setRecordedChunks([...chunks]);
        }
      };

      // Handle recording stop
      recorder.onstop = () => {
        // Clean up stream tracks
        displayStream.getTracks().forEach(track => track.stop());
        
        // Create preview when recording is stopped
        if (chunks.length > 0) {
          createRecordingPreview(chunks);
        }
        
        setRecording(false);
        setStream(null);
      };

      // Start recording
      recorder.start(100); // Collect data every 100ms
      setRecording(true);
      toast.success(`Recording started in ${formatOption.label} format`);
      
    } catch (err) {
      console.error("Error starting screen recording:", err);
      toast.error("Failed to start recording. Please try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      toast.info("Preparing your recording...");
    }
  };

  const createRecordingPreview = (chunks: Blob[]) => {
    const formatOption = getSelectedFormatOption();
    
    // Create blob from recorded chunks
    const blob = new Blob(chunks, { type: formatOption.mimeType });
    
    // Create preview URL
    const url = URL.createObjectURL(blob);
    setRecordedVideoUrl(url);
    
    // Set video source for preview (only for video formats)
    if (recordedVideoRef.current && selectedFormat !== 'wav') {
      recordedVideoRef.current.src = url;
    }
    
    toast.success("Recording ready for download!");
  };

  const downloadRecording = () => {
    if (!recordedVideoUrl) return;
    
    const formatOption = getSelectedFormatOption();
    
    // Create download link
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `screen-recording-${new Date().toISOString().split('T')[0]}.${formatOption.extension}`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      toast.success("Recording downloaded successfully!");
    }, 100);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Screen Recorder</h1>
        <p className="text-muted-foreground">Record your screen and save in multiple formats</p>
      </div>

      {/* Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Output Format
        </label>
        <Select value={selectedFormat} onValueChange={(value: VideoFormat) => setSelectedFormat(value)} disabled={recording}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            {formatOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Live Preview */}
      <div className="w-full max-w-3xl mb-6">
        <h3 className="text-lg font-semibold mb-2 text-foreground">Live Preview</h3>
        {selectedFormat !== 'wav' ? (
          <video 
            ref={liveVideoRef} 
            className="w-full h-auto border-2 border-border rounded-lg bg-black"
            style={{ maxHeight: "400px" }} 
            autoPlay 
            muted
            playsInline
          >
            Your browser doesn't support video playback.
          </video>
        ) : (
          <div className="w-full h-64 border-2 border-border rounded-lg bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-center">
              Audio recording mode - no video preview available
            </p>
          </div>
        )}
        {!stream && !recording && selectedFormat !== 'wav' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-center p-4">
              Start recording to preview your screen here
            </p>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="flex gap-4 mb-6">
        <Button
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3"
          onClick={startRecording}
          disabled={recording}
        >
          <Play className="mr-2 h-5 w-5" /> Start Recording
        </Button>
        <Button
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3"
          onClick={stopRecording}
          disabled={!recording}
        >
          <StopCircle className="mr-2 h-5 w-5" /> Stop Recording
        </Button>
      </div>

      {/* Recorded Video Preview & Download */}
      {recordedVideoUrl && (
        <div className="w-full max-w-3xl">
          <h3 className="text-lg font-semibold mb-2 text-foreground">Recorded Video</h3>
          {selectedFormat !== 'wav' ? (
            <video 
              ref={recordedVideoRef}
              className="w-full h-auto border-2 border-border rounded-lg mb-4"
              style={{ maxHeight: "400px" }}
              controls
            >
              Your browser doesn't support video playback.
            </video>
          ) : (
            <div className="w-full h-32 border-2 border-border rounded-lg bg-muted flex items-center justify-center mb-4">
              <p className="text-muted-foreground text-center">
                Audio recording completed - {getSelectedFormatOption().label}
              </p>
            </div>
          )}
          
          <div className="text-center">
            <Button
              onClick={downloadRecording}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3"
            >
              <Download className="mr-2 h-5 w-5" /> 
              Download {getSelectedFormatOption().label}
            </Button>
          </div>
        </div>
      )}
      
      <div className="mt-8 text-sm text-muted-foreground text-center">
        <p className="mb-1">Note: Your recording will be saved locally in the selected format.</p>
        <p>This app works best on Chrome and Edge browsers on Windows.</p>
        <p>MP4 format may fallback to WebM if not supported by your browser.</p>
      </div>
    </div>
  );
};

export default ScreenRecorder;
