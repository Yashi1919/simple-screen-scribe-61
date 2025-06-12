
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Play, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Recording {
  id: string;
  name: string;
  url: string;
  format: string;
  size: string;
  duration: string;
  timestamp: Date;
}

interface RecordingHistoryProps {
  recordings: Recording[];
  onDownload: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onPreview: (recording: Recording) => void;
}

const RecordingHistory = ({ recordings, onDownload, onDelete, onPreview }: RecordingHistoryProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (recordings.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Recording History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No recordings yet</p>
            <p className="text-sm">Start recording to see your history here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Clock className="mr-2 h-5 w-5" />
          Recording History ({recordings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {recordings.map((recording) => (
            <div key={recording.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-sm truncate">{recording.name}</h4>
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    {recording.format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                  <span>{recording.size}</span>
                  <span>{recording.duration}</span>
                  <span>{formatTimestamp(recording.timestamp)}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 ml-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPreview(recording)}
                  className="h-8 w-8 p-0"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDownload(recording)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(recording.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecordingHistory;
