import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Video, Settings, History, Download, Maximize, Minimize } from "lucide-react";
import { toast } from "sonner";

import RecordingControls from "./RecordingControls";
import FormatSettings, { formatOptions } from "./FormatSettings";
import RecordingHistory from "./RecordingHistory";

interface Recording {
  id: string;
  name: string;
  url: string;
  format: string;
  size: string;
  duration: string;
  timestamp: Date;
}

const ScreenRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('webm-vp9');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [quality, setQuality] = useState('high');
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeTab, setActiveTab] = useState('record');
  const [videoLoading, setVideoLoading] = useState(false);
  
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const recordedVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const recordingChunks = useRef<Blob[]>([]);

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
      recordings.forEach(recording => {
        URL.revokeObjectURL(recording.url);
      });
    };
  }, [recordedVideoUrl, recordings]);

  const getSelectedFormatOption = () => {
    return formatOptions.find(option => option.value === selectedFormat) || formatOptions[0];
  };

  const getBestSupportedMimeType = (preferredFormat: string) => {
    // Priority list of formats for better compatibility
    const formatPriority = [
      'video/webm; codecs=vp9,opus',
      'video/webm; codecs=vp8,opus', 
      'video/webm; codecs=h264,opus',
      'video/webm',
      'video/mp4; codecs=h264,aac',
      'video/mp4'
    ];

    // Check if preferred format is supported
    const formatOption = getSelectedFormatOption();
    if (MediaRecorder.isTypeSupported(formatOption.mimeType)) {
      return formatOption.mimeType;
    }

    // Find first supported format from priority list
    for (const mimeType of formatPriority) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Using fallback format: ${mimeType}`);
        return mimeType;
      }
    }

    // Last resort
    return 'video/webm';
  };

  const startWebcam = async () => {
    try {
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 320 }, 
          height: { ideal: 240 },
          facingMode: 'user'
        },
        audio: false
      });
      setWebcamStream(webcamStream);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = webcamStream;
        webcamVideoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      toast.error("Failed to access webcam");
      setWebcamEnabled(false);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (webcamEnabled) {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [webcamEnabled]);

  const startRecording = async () => {
    try {
      const formatOption = getSelectedFormatOption();
      const isAudioOnly = formatOption.value.includes('wav') || 
                         formatOption.value.includes('mp3') || 
                         formatOption.value.includes('ogg');
      
      // Get screen capture stream with better quality settings
      const constraints: any = {
        video: !isAudioOnly ? { 
          displaySurface: "monitor",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        } : false,
        audio: includeAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } : false,
      };

      const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setStream(displayStream);

      // Display live preview (only for video formats)
      if (liveVideoRef.current && !isAudioOnly) {
        liveVideoRef.current.srcObject = displayStream;
        liveVideoRef.current.play().catch(e => console.log('Live preview play error:', e));
      }

      // Get best supported MIME type
      const mimeType = getBestSupportedMimeType(formatOption.value);
      
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: quality === 'ultra' ? 6000000 : 
                           quality === 'high' ? 3000000 : 
                           quality === 'medium' ? 1500000 : 500000
      };

      const recorder = new MediaRecorder(displayStream, recorderOptions);
      setMediaRecorder(recorder);
      
      // Reset chunks
      recordingChunks.current = [];
      
      // Store recorded chunks
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunks.current.push(e.data);
          console.log('Data chunk received:', e.data.size, 'bytes');
        }
      };

      // Handle recording stop
      recorder.onstop = () => {
        console.log('Recording stopped, processing chunks...');
        // Clean up stream tracks
        displayStream.getTracks().forEach(track => track.stop());
        
        // Create recording entry
        if (recordingChunks.current.length > 0) {
          createRecordingEntry(recordingChunks.current, mimeType, formatOption);
        } else {
          toast.error('No recording data available');
        }
        
        setRecording(false);
        setPaused(false);
        setStream(null);
        
        // Clear live preview
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = null;
        }
      };

      // Start recording with smaller time slices for better compatibility
      recorder.start(1000);
      setRecording(true);
      toast.success(`Recording started in ${formatOption.label} format`);
      
    } catch (err) {
      console.error("Error starting screen recording:", err);
      toast.error("Failed to start recording. Please check permissions and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      toast.info("Processing your recording...");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && recording && !paused) {
      mediaRecorder.pause();
      setPaused(true);
      toast.info("Recording paused");
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && recording && paused) {
      mediaRecorder.resume();
      setPaused(false);
      toast.info("Recording resumed");
    }
  };

  const createRecordingEntry = (chunks: Blob[], mimeType: string, formatOption: any) => {
    console.log('Creating recording entry with', chunks.length, 'chunks');
    const blob = new Blob(chunks, { type: mimeType });
    console.log('Created blob:', blob.size, 'bytes, type:', blob.type);
    
    const url = URL.createObjectURL(blob);
    const timestamp = new Date();
    
    const recording: Recording = {
      id: Date.now().toString(),
      name: `Recording ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`,
      url,
      format: formatOption.extension,
      size: (blob.size / (1024 * 1024)).toFixed(2) + ' MB',
      duration: '00:00',
      timestamp
    };
    
    setRecordings(prev => [recording, ...prev]);
    setRecordedVideoUrl(url);
    
    // Improved video preview setup
    const isAudioOnly = formatOption.value.includes('wav') || 
                       formatOption.value.includes('mp3') || 
                       formatOption.value.includes('ogg');
    
    if (!isAudioOnly && recordedVideoRef.current) {
      setVideoLoading(true);
      recordedVideoRef.current.src = url;
      recordedVideoRef.current.load();
      
      // Better event handling for video loading
      recordedVideoRef.current.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        setVideoLoading(false);
      };
      
      recordedVideoRef.current.onloadeddata = () => {
        console.log('Video data loaded successfully');
        setVideoLoading(false);
      };
      
      recordedVideoRef.current.onerror = (e) => {
        console.error('Video loading error:', e);
        setVideoLoading(false);
        toast.error('Error loading video preview');
      };
      
      recordedVideoRef.current.oncanplay = () => {
        console.log('Video can play');
        setVideoLoading(false);
      };
    }
    
    // Switch to preview tab to show the recorded video
    setActiveTab('preview');
    toast.success("Recording ready for preview!");
  };

  const downloadRecording = (recording: Recording) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Mobile-friendly download
      try {
        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = recording.url;
        link.download = `${recording.name}.${recording.format}`;
        
        // For mobile browsers, open in new tab if direct download fails
        link.target = '_blank';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
        
        toast.success("Download started! Check your Downloads folder.");
      } catch (error) {
        console.error('Mobile download error:', error);
        // Fallback: open video in new tab
        window.open(recording.url, '_blank');
        toast.info("Video opened in new tab. Use browser menu to save.");
      }
    } else {
      // Desktop download
      const a = document.createElement('a');
      a.href = recording.url;
      a.download = `${recording.name}.${recording.format}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        toast.success("Recording downloaded successfully!");
      }, 100);
    }
  };

  const deleteRecording = (id: string) => {
    setRecordings(prev => {
      const recording = prev.find(r => r.id === id);
      if (recording) {
        URL.revokeObjectURL(recording.url);
      }
      return prev.filter(r => r.id !== id);
    });
    toast.success("Recording deleted");
  };

  const previewRecording = (recording: Recording) => {
    setRecordedVideoUrl(recording.url);
    const isAudioOnly = recording.format.includes('wav') || 
                       recording.format.includes('mp3') || 
                       recording.format.includes('ogg');
    
    if (!isAudioOnly && recordedVideoRef.current) {
      setVideoLoading(true);
      recordedVideoRef.current.src = recording.url;
      recordedVideoRef.current.load();
      
      recordedVideoRef.current.onloadeddata = () => {
        console.log('Preview video loaded successfully');
        setVideoLoading(false);
      };
      
      recordedVideoRef.current.onerror = (e) => {
        console.error('Preview video loading error:', e);
        setVideoLoading(false);
        toast.error('Error loading video preview');
      };
    }
    setActiveTab('preview');
  };

  const isAudioOnlyFormat = () => {
    const formatOption = getSelectedFormatOption();
    return formatOption.value.includes('wav') || 
           formatOption.value.includes('mp3') || 
           formatOption.value.includes('ogg');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Video className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Advanced Screen Recorder
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional screen recording with multiple formats, webcam overlay, and advanced controls
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-md mx-auto mb-8">
            <TabsTrigger value="record" className="flex items-center space-x-2">
              <Monitor className="h-4 w-4" />
              <span>Record</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center space-x-2">
              <Video className="h-4 w-4" />
              <span>Preview</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Live Preview */}
              <div className="lg:col-span-2">
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Monitor className="h-5 w-5" />
                      <span>Live Preview</span>
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFullscreenPreview(!fullscreenPreview)}
                    >
                      {fullscreenPreview ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className={`relative w-full bg-black rounded-lg overflow-hidden ${fullscreenPreview ? 'h-96' : 'h-64'}`}>
                      {!isAudioOnlyFormat() ? (
                        <>
                          <video 
                            ref={liveVideoRef} 
                            className="w-full h-full object-contain"
                            autoPlay 
                            muted
                            playsInline
                            onError={(e) => console.error('Live preview error:', e)}
                          >
                            Your browser doesn't support video playback.
                          </video>
                          
                          {/* Webcam Overlay */}
                          {webcamEnabled && webcamStream && (
                            <div className="absolute bottom-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-white shadow-lg">
                              <video
                                ref={webcamVideoRef}
                                className="w-full h-full object-cover"
                                autoPlay
                                muted
                                playsInline
                              />
                            </div>
                          )}
                          
                          {!stream && !recording && (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                              <div className="text-center p-6">
                                <Monitor className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                  Start recording to preview your screen here
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/80">
                          <div className="text-center p-6">
                            <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                              Audio recording mode - no video preview available
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Settings */}
              <div className="space-y-4">
                <FormatSettings
                  selectedFormat={selectedFormat}
                  onFormatChange={setSelectedFormat}
                  includeAudio={includeAudio}
                  onAudioToggle={setIncludeAudio}
                  quality={quality}
                  onQualityChange={setQuality}
                  disabled={recording}
                />
                
                {/* Webcam Toggle */}
                {!isAudioOnlyFormat() && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Webcam Overlay</h4>
                          <p className="text-sm text-muted-foreground">Add webcam to recording</p>
                        </div>
                        <Switch 
                          checked={webcamEnabled} 
                          onCheckedChange={setWebcamEnabled}
                          disabled={recording}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center">
              <RecordingControls
                recording={recording}
                paused={paused}
                onStart={startRecording}
                onStop={stopRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="max-w-2xl mx-auto">
              <FormatSettings
                selectedFormat={selectedFormat}
                onFormatChange={setSelectedFormat}
                includeAudio={includeAudio}
                onAudioToggle={setIncludeAudio}
                quality={quality}
                onQualityChange={setQuality}
                disabled={recording}
              />
            </div>
          </TabsContent>

          <TabsContent value="preview">
            {recordedVideoUrl ? (
              <div className="max-w-4xl mx-auto space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Recorded Video Preview</span>
                      <Button onClick={() => downloadRecording({
                        id: 'current',
                        name: `Screen Recording ${new Date().toLocaleDateString()}`,
                        url: recordedVideoUrl,
                        format: getSelectedFormatOption().extension,
                        size: '0 MB',
                        duration: '00:00',
                        timestamp: new Date()
                      })}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!isAudioOnlyFormat() ? (
                      <div className="relative">
                        {videoLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-10">
                            <div className="text-white">Loading video...</div>
                          </div>
                        )}
                        <video 
                          ref={recordedVideoRef}
                          className="w-full h-auto border-2 border-border rounded-lg bg-black"
                          style={{ maxHeight: "500px" }}
                          controls
                          preload="metadata"
                          playsInline
                          onLoadStart={() => setVideoLoading(true)}
                          onCanPlay={() => setVideoLoading(false)}
                          onError={(e) => {
                            console.error('Recorded video playback error:', e);
                            setVideoLoading(false);
                            toast.error('Error playing video. Try downloading instead.');
                          }}
                        >
                          Your browser doesn't support video playback.
                        </video>
                      </div>
                    ) : (
                      <div className="w-full h-48 border-2 border-border rounded-lg bg-muted flex items-center justify-center">
                        <div className="text-center">
                          <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            Audio recording completed - {getSelectedFormatOption().label}
                          </p>
                          <audio controls className="mt-4">
                            <source src={recordedVideoUrl} />
                            Your browser doesn't support audio playback.
                          </audio>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <Video className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Recording Available</h3>
                <p className="text-muted-foreground">Start recording to see preview here</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="max-w-4xl mx-auto">
              <RecordingHistory
                recordings={recordings}
                onDownload={downloadRecording}
                onDelete={deleteRecording}
                onPreview={previewRecording}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ScreenRecorder;
