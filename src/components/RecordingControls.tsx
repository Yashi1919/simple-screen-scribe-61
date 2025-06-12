
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, StopCircle, Pause, RotateCcw } from "lucide-react";

interface RecordingControlsProps {
  recording: boolean;
  paused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  disabled?: boolean;
}

const RecordingControls = ({ 
  recording, 
  paused, 
  onStart, 
  onStop, 
  onPause, 
  onResume,
  disabled = false 
}: RecordingControlsProps) => {
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (recording && !paused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [recording, paused]);

  useEffect(() => {
    if (!recording) {
      setRecordingTime(0);
    }
  }, [recording]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Recording Timer */}
      {recording && (
        <div className="flex items-center space-x-3 bg-card border rounded-lg px-4 py-2">
          <div className={`w-3 h-3 rounded-full ${paused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-lg font-mono font-semibold text-foreground">
            {formatTime(recordingTime)}
          </span>
          <span className="text-sm text-muted-foreground">
            {paused ? 'PAUSED' : 'RECORDING'}
          </span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        {!recording ? (
          <Button
            onClick={onStart}
            disabled={disabled}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
          >
            <Play className="mr-2 h-5 w-5" />
            Start Recording
          </Button>
        ) : (
          <>
            <Button
              onClick={paused ? onResume : onPause}
              size="lg"
              variant="outline"
              className="px-6 py-3"
            >
              {paused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
            <Button
              onClick={onStop}
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3"
            >
              <StopCircle className="mr-2 h-5 w-5" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default RecordingControls;
