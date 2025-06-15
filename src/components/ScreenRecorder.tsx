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
import { useFfmpegConvert } from "@/hooks/useFfmpegConvert";

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
  // Set default format to WebM VP9, since MP4 is removed
  const [selectedFormat, setSelectedFormat] = useState('webm-vp9'); // Default now webm-vp9
  const [includeAudio, setIncludeAudio] = useState(true);
  const [quality, setQuality] = useState('high');
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeTab, setActiveTab] = useState('record');
  const [videoLoading, setVideoLoading] = useState(false);
  const [convertingMp4, setConvertingMp4] = useState(false);
  const [convertedMp4Url, setConvertedMp4Url] = useState<string | null>(null);
  const [mp4Duration, setMp4Duration] = useState<number | null>(null);

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

  const trueMp4Supported = () => false; // Always false - MP4 not recording any more

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
      
      let constraints: any = {
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

      const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setStream(displayStream);

      if (liveVideoRef.current && !isAudioOnly) {
        liveVideoRef.current.srcObject = displayStream;
        liveVideoRef.current.play().catch(e => console.log('Live preview play error:', e));
      }

      // Always use WebM or fallback
      let mimeType = "";
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
        mimeType = 'video/webm; codecs=vp8';
      } else {
        mimeType = 'video/webm';
      }
      // Warn if someone expected MP4
      if (formatOption.value === "mp4-h264") {
        toast.error("MP4 direct recording is no longer available. Record in WebM and then convert.");
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
      toast.success("Recording started in WebM format");
      
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

  const downloadRecording = async (recording: Recording) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let fileName = `${recording.name.replace(/[^a-zA-Z0-9]/g, '_')}.${recording.format}`;
    if (recording.format === "mp4" && !trueMp4Supported()) {
      fileName = `${recording.name.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
      toast.error("Recording is actually WebM, not MP4. WhatsApp may not accept it.");
    }

    try {
      const response = await fetch(recording.url);
      const blob = await response.blob();
      console.log("DOWNLOAD: Blob size:", blob.size, "type:", blob.type, "expected format:", recording.format);
      if (blob.size === 0) {
        toast.error("Cannot download video – file is empty. Please try recording again.");
        return;
      }
      if (!blob.type.includes("mp4") && recording.format === "mp4") {
        toast.error("Warning: This MP4 may not be valid! (MIME type: " + blob.type + ")");
      }

      if (isMobile) {
        const arrayBuffer = await blob.arrayBuffer();
        const fileType = blob.type || (recording.format === "mp4" ? "video/mp4" : "video/webm");
        const file = new File([arrayBuffer], fileName, { type: fileType });
        // Try using Web Share API if available (best for WhatsApp mobile)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: fileName,
              text: "Screen recording video",
            });
            toast.success("Share sheet opened! You can now send your video via WhatsApp or save it to your device.");
            return;
          } catch (err) {
            console.error("Web Share error:", err);
            // fallback to download below
          }
        }
        // Fallback to anchor File download
        try {
          const tempUrl = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = tempUrl;
          a.download = fileName;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(tempUrl);
          }, 1500);
          toast.success("Video downloaded! You can now share it on WhatsApp from your gallery/downloads.");
        } catch (error) {
          console.error('Mobile anchor File download fallback error:', error);
          // As a last resort, open in new tab
          window.open(recording.url, '_blank');
          toast.info("Video opened in new tab. Save it and share on WhatsApp from your gallery.");
        }
      } else {
        // Desktop download: unchanged
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
    } catch (err) {
      console.error("Download handler error:", err);
      toast.error("There was an error when preparing your video for download. Try recording and converting again.");
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

  // FFmpeg hook for conversion
  const {
    loading: ffmpegLoading,
    progress: ffmpegProgress,
    error: ffmpegError,
    outputUrl: ffmpegOutputUrl,
    convertWebmToMp4,
    cleanUp: cleanUpFfmpeg,
  } = useFfmpegConvert();

  // Helper to get current Blob data from recordedVideoUrl (WebM) for conversion
  const fetchBlobFromUrl = async (url: string) => {
    const res = await fetch(url);
    return await res.blob();
  };

  // Handler to convert WebM to MP4 using ffmpeg.wasm
  const handleConvertToMp4 = async () => {
    if (!recordedVideoUrl) return;
    setConvertingMp4(true);
    cleanUpFfmpeg();
    toast.info("Converting to MP4... This may take a while for large videos.");
    const blob = await fetchBlobFromUrl(recordedVideoUrl);

    const mp4Url = await convertWebmToMp4(blob);

    if (mp4Url) {
      setConvertedMp4Url(mp4Url);
      toast.success("Conversion complete! You can now download a real MP4 for WhatsApp.");
    } else {
      toast.error("MP4 conversion failed. Please try with a shorter video or use an external tool.");
    }
    setConvertingMp4(false);
  };

  // Clean up converted URLs when switching files or on unmount
  useEffect(() => {
    return () => {
      if (convertedMp4Url) {
        URL.revokeObjectURL(convertedMp4Url);
      }
      cleanUpFfmpeg();
    };
  }, [convertedMp4Url, cleanUpFfmpeg]);

  // Helper - check for .mp4 duration "00:00" using video element (after setConvertedMp4Url)
  useEffect(() => {
    if (convertedMp4Url) {
      const v = document.createElement('video');
      v.src = convertedMp4Url;
      v.onloadedmetadata = () => {
        setMp4Duration(v.duration);
      };
      v.onerror = () => {
        setMp4Duration(null);
      };
    } else {
      setMp4Duration(null);
    }
  }, [convertedMp4Url]);

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
                      <div className="flex gap-2">
                        {/* Download WebM option */}
                        {!isAudioOnlyFormat() && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = recordedVideoUrl;
                              a.download = `ScreenRecording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                              document.body.appendChild(a);
                              a.click();
                              setTimeout(() => document.body.removeChild(a), 100);
                            }}
                          >
                            Download WebM
                          </Button>
                        )}
                        {/* Convert/Download MP4 if available */}
                        {!isAudioOnlyFormat() && (
                          <>
                            <Button
                              onClick={handleConvertToMp4}
                              disabled={convertingMp4 || ffmpegLoading}
                              variant="secondary"
                            >
                              {ffmpegLoading || convertingMp4 ? (
                                <span>
                                  Converting... {ffmpegProgress ? `${ffmpegProgress}%` : ""}
                                </span>
                              ) : (
                                <span>Convert to MP4</span>
                              )}
                            </Button>
                          </>
                        )}
                        {/* Download original (current) file */}
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
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* MP4 conversion warning for 00:00 duration */}
                    {convertedMp4Url && (
                      <div className="mb-2 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                        <strong>Notice:</strong> MP4 file may show <b>duration as 00:00</b> or fail to play in some players and WhatsApp. This is a known browser FFmpeg limitation.<br />
                        <span>If you see this, <b>please convert the WebM on your Desktop</b> using the official FFmpeg tool for full compatibility.</span>
                        <div className="mt-2">
                          <span className="block font-mono bg-gray-100 rounded px-2 py-1 text-[90%]">
                            ffmpeg -i input.webm -c:v libx264 -c:a aac -ac 2 -movflags +faststart output.mp4
                          </span>
                          <div className="mt-1 text-xs text-muted-foreground">
                            <b>How to:</b> Install FFmpeg (<a className="underline" href="https://ffmpeg.org/download.html" target="_blank">download here</a>), open a terminal/cmd, and run this command in the folder with your WebM file.
                          </div>
                        </div>
                        {/* Show duration check */}
                        {(mp4Duration !== null && mp4Duration < 1) && (
                          <div className="mt-2 text-red-700 text-xs font-medium">
                            Detected MP4 duration = 00:00<br />
                            This file won't work on WhatsApp. Please use desktop FFmpeg for conversion.
                          </div>
                        )}
                      </div>
                    )}
                    {ffmpegError && (
                      <div className="mb-2 p-2 bg-destructive/10 text-destructive rounded">
                        <p className="text-xs">{ffmpegError}</p>
                      </div>
                    )}
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
                        {/* If conversion done, show the MP4 download + player */}
                        {convertedMp4Url && (
                          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="mb-2 font-medium text-green-800">
                              ✅ Converted MP4 (Works on WhatsApp & full metadata)
                            </div>
                            <video
                              src={convertedMp4Url}
                              className="w-full h-auto border-2 border-green-400 rounded bg-black"
                              style={{ maxHeight: "400px" }}
                              controls
                            />
                            <Button
                              className="mt-3"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = convertedMp4Url;
                                a.download = `Screen Recording ${new Date().toLocaleDateString()}.mp4`;
                                document.body.appendChild(a);
                                a.click();
                                setTimeout(() => document.body.removeChild(a), 100);
                                toast.success("WhatsApp-ready MP4 downloaded!");
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download MP4
                            </Button>
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
