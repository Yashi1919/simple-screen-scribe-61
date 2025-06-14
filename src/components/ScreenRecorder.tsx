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
  const [selectedFormat, setSelectedFormat] = useState('mp4-h264'); // Default to MP4 for better compatibility
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

  const getBestSupportedMimeType = () => {
    // Prioritize widely supported formats for better compatibility
    const supportedFormats = [
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264 + AAC
      'video/mp4; codecs="avc1.42E01E"', // H.264 only
      'video/mp4', // Generic MP4
      'video/webm; codecs=vp9,opus',
      'video/webm; codecs=vp8,opus',
      'video/webm'
    ];

    for (const mimeType of supportedFormats) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Using supported format: ${mimeType}`);
        return mimeType;
      }
    }

    // Fallback
    console.warn('No preferred format supported, using default');
    return 'video/mp4';
  };

  const trueMp4Supported = () => {
    if (typeof window !== "undefined" && "MediaRecorder" in window) {
      return MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') ||
        MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E"') ||
        MediaRecorder.isTypeSupported('video/mp4');
    }
    return false;
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
      
      let useMp4 = formatOption.value === 'mp4-h264' && trueMp4Supported();
      let constraints: any;
      if (useMp4) {
        constraints = {
          video: { 
            displaySurface: "monitor",
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: includeAudio ? {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            channelCount: 2
          } : false,
        };
      } else {
        // fallback to webm
        constraints = {
          video: !isAudioOnly ? { 
            displaySurface: "monitor",
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          } : false,
          audio: includeAudio ? {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            channelCount: 2
          } : false,
        };
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setStream(displayStream);

      if (liveVideoRef.current && !isAudioOnly) {
        liveVideoRef.current.srcObject = displayStream;
        liveVideoRef.current.play().catch(e => console.log('Live preview play error:', e));
      }

      // choose proper mimeType/check fallback
      let mimeType = "";
      if (useMp4) {
        mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
        mimeType = 'video/webm; codecs=vp8';
      } else {
        mimeType = 'video/webm';
      }

      // If MP4 selected but browser doesn't support, show toast warning
      if (formatOption.value === "mp4-h264" && !trueMp4Supported()) {
        toast.error("Your browser does not support MP4/H.264 encoding for screen recording. Recording will be saved in WebM format. This may NOT work with WhatsApp.");
      }

      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: quality === 'ultra' ? 4000000 : 
                           quality === 'high' ? 2500000 : 
                           quality === 'medium' ? 1500000 : 800000,
        audioBitsPerSecond: 128000
      };

      const recorder = new MediaRecorder(displayStream, recorderOptions);
      setMediaRecorder(recorder);
      
      recordingChunks.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunks.current.push(e.data);
          console.log('Data chunk received:', e.data.size, 'bytes');
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped, processing chunks...');
        displayStream.getTracks().forEach(track => track.stop());
        
        if (recordingChunks.current.length > 0) {
          createRecordingEntry(recordingChunks.current, mimeType, formatOption);
        } else {
          toast.error('No recording data available');
        }
        
        setRecording(false);
        setPaused(false);
        setStream(null);
        
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = null;
        }
      };

      recorder.start(1000); // Use 1 second chunks for better stability
      setRecording(true);
      toast.success(`Recording started in ${useMp4 ? 'MP4' : 'WebM'} format`);
      
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
    
    // Create blob with proper MIME type
    const blob = new Blob(chunks, { type: mimeType });
    console.log('Created blob:', blob.size, 'bytes, type:', blob.type);
    
    // Validate blob
    if (blob.size === 0) {
      toast.error('Recording failed - no data captured');
      return;
    }
    
    const url = URL.createObjectURL(blob);
    const timestamp = new Date();
    
    // Use proper file extension ONLY IF supported
    let fileExtension = 'webm';
    let realMp4 = false;
    if (mimeType.includes("mp4")) {
      fileExtension = "mp4";
      realMp4 = true;
    } else if (mimeType.includes("webm")) {
      fileExtension = "webm";
    }
    // IF fake mp4 from unsupported browser, force extension and show toast
    if (formatOption.value === "mp4-h264" && !realMp4) {
      fileExtension = "webm";
      toast.error("Recording could not be saved as MP4 in this browser. Downloaded file will be WebM instead. Please use a supported browser for WhatsApp-ready .mp4 files.");
    }
    
    const recording: Recording = {
      id: Date.now().toString(),
      name: `Screen Recording ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`,
      url,
      format: fileExtension,
      size: (blob.size / (1024 * 1024)).toFixed(2) + ' MB',
      duration: '00:00',
      timestamp
    };
    
    setRecordings(prev => [recording, ...prev]);
    setRecordedVideoUrl(url);
    
    const isAudioOnly = formatOption.value.includes('wav') || 
                       formatOption.value.includes('mp3') || 
                       formatOption.value.includes('ogg');
    
    if (!isAudioOnly) {
      setVideoLoading(true);
      console.log('Setting up video preview for:', url);
      
      // Clear previous video
      if (recordedVideoRef.current) {
        recordedVideoRef.current.pause();
        recordedVideoRef.current.removeAttribute('src');
        recordedVideoRef.current.load();
      }
      
      // Set up new video with proper error handling
      setTimeout(() => {
        if (recordedVideoRef.current) {
          const videoElement = recordedVideoRef.current;
          
          videoElement.onloadstart = () => {
            console.log('Video loading started');
          };
          
          videoElement.onloadeddata = () => {
            console.log('Video data loaded successfully');
            setVideoLoading(false);
          };
          
          videoElement.oncanplay = () => {
            console.log('Video can start playing');
          };
          
          videoElement.onerror = (e) => {
            console.error('Video loading error:', e);
            console.error('Video error details:', videoElement.error);
            setVideoLoading(false);
            toast.error('Video format not supported by browser. Try a different format.');
          };
          
          videoElement.onloadedmetadata = () => {
            console.log('Video metadata loaded');
          };
          
          // Set the source and load
          videoElement.src = url;
          videoElement.load();
        }
      }, 100);
    }
    
    setActiveTab('preview');
    toast.success("Recording ready for preview!");
  };

  const downloadRecording = (recording: Recording) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Only offer .mp4 if it's truly mp4, else fallback to .webm
    let fileName = `${recording.name.replace(/[^a-zA-Z0-9]/g, '_')}.${recording.format}`;
    if (recording.format === "mp4" && !trueMp4Supported()) {
      // prevent fake .mp4 download
      fileName = `${recording.name.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
      toast.error("Recording is actually WebM, not MP4. WhatsApp may not accept it.");
    }

    if (isMobile) {
      // Mobile-friendly download with WhatsApp sharing hint
      try {
        const link = document.createElement('a');
        link.href = recording.url;
        link.download = fileName;
        link.target = '_blank';
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
        
        toast.success("Video downloaded! You can now share it on WhatsApp from your gallery/downloads.");
      } catch (error) {
        console.error('Mobile download error:', error);
        window.open(recording.url, '_blank');
        toast.info("Video opened in new tab. Save it and share on WhatsApp from your gallery.");
      }
    } else {
      // Desktop download
      const a = document.createElement('a');
      a.href = recording.url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        toast.success("WhatsApp-compatible video downloaded successfully!");
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
    console.log('Previewing recording:', recording);
    setRecordedVideoUrl(recording.url);
    const isAudioOnly = recording.format.includes('wav') || 
                       recording.format.includes('mp3') || 
                       recording.format.includes('ogg');
    
    if (!isAudioOnly && recordedVideoRef.current) {
      setVideoLoading(true);
      
      const videoElement = recordedVideoRef.current;
      
      // Clear previous source
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
      
      // Set up event handlers
      videoElement.onloadeddata = () => {
        console.log('Preview video loaded successfully');
        setVideoLoading(false);
      };
      
      videoElement.onerror = (e) => {
        console.error('Preview video loading error:', e);
        console.error('Preview video error details:', videoElement.error);
        setVideoLoading(false);
        toast.error('Video format not supported. Try downloading and playing in a media player.');
      };
      
      // Set new source
      setTimeout(() => {
        videoElement.src = recording.url;
        videoElement.load();
      }, 100);
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
                          muted={false}
                        >
                          <p>Your browser doesn't support video playback. Please try downloading the video.</p>
                        </video>
                        {recordedVideoRef.current?.error && (
                          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-destructive text-sm">
                              Video format not supported by browser. Please download the video and play it in a media player.
                            </p>
                          </div>
                        )}
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
