
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";
import { toast } from "sonner";

const ScreenRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check browser compatibility
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast.error("Your browser doesn't support screen recording");
    }
  }, []);

  const startRecording = async () => {
    try {
      // Get screen capture stream
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          displaySurface: "monitor",
        },
        audio: true,
      });
      
      setStream(displayStream);

      // Display preview
      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }

      // Set up media recorder
      const recorder = new MediaRecorder(displayStream, {
        mimeType: 'video/webm; codecs=vp9',
      });
      
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
        
        // Create download when recording is stopped
        if (chunks.length > 0) {
          saveRecording(chunks);
        }
        
        setRecording(false);
        setStream(null);
      };

      // Start recording
      recorder.start(100); // Collect data every 100ms
      setRecording(true);
      toast.success("Recording started");
      
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

  const saveRecording = (chunks: Blob[]) => {
    // Create blob from recorded chunks
    const blob = new Blob(chunks, { type: 'video/webm' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Set download attributes
    a.href = url;
    a.download = `screen-recording-${new Date().toISOString().split('T')[0]}.webm`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Recording saved");
    }, 100);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Screen Recorder</h1>
        <p className="text-gray-600">Record your screen and save the video locally</p>
      </div>
      
      <div className="w-full max-w-3xl mb-6">
        <video 
          ref={videoRef} 
          className="w-full h-auto border-2 border-gray-300 rounded-lg bg-black"
          style={{ maxHeight: "500px" }} 
          autoPlay 
          muted
          playsInline
        >
          Your browser doesn't support video playback.
        </video>
        {!stream && !recording && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-500 text-center p-4">
              Start recording to preview your screen here
            </p>
          </div>
        )}
      </div>
      
      <div className="flex gap-4">
        <Button
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-5"
          onClick={startRecording}
          disabled={recording}
        >
          <Play className="mr-2 h-5 w-5" /> Start Recording
        </Button>
        <Button
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-5"
          onClick={stopRecording}
          disabled={!recording}
        >
          <StopCircle className="mr-2 h-5 w-5" /> Stop Recording
        </Button>
      </div>
      
      <div className="mt-8 text-sm text-gray-500">
        <p className="mb-1">Note: Your recording will be saved locally as a .webm file.</p>
        <p>This app works best on Chrome and Edge browsers on Windows.</p>
      </div>
    </div>
  );
};

export default ScreenRecorder;
