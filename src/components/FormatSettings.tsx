
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface FormatOption {
  value: string;
  label: string;
  mimeType: string;
  extension: string;
  quality?: string;
  disabled?: boolean;
}

interface FormatSettingsProps {
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  includeAudio: boolean;
  onAudioToggle: (include: boolean) => void;
  quality: string;
  onQualityChange: (quality: string) => void;
  disabled?: boolean;
}

// Helper to detect MP4 support
const isMp4Supported = () => {
  if (typeof window !== "undefined" && "MediaRecorder" in window) {
    // Safari's implementation sometimes supports H.264 (not always); in most browsers it's false
    return MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') ||
      MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E"') ||
      MediaRecorder.isTypeSupported('video/mp4');
  }
  return false;
};

const rawFormatOptions: FormatOption[] = [
  { value: 'mp4-h264', label: 'MP4 (H.264) - Recommended for WhatsApp', mimeType: 'video/mp4', extension: 'mp4', quality: 'high' },
  { value: 'webm-vp9', label: 'WebM (VP9)', mimeType: 'video/webm; codecs=vp9', extension: 'webm', quality: 'high' },
  { value: 'webm-vp8', label: 'WebM (VP8)', mimeType: 'video/webm; codecs=vp8', extension: 'webm', quality: 'medium' },
  { value: 'mkv', label: 'MKV', mimeType: 'video/x-matroska', extension: 'mkv', quality: 'high' },
  { value: 'avi', label: 'AVI', mimeType: 'video/avi', extension: 'avi', quality: 'medium' },
  { value: 'mov', label: 'MOV', mimeType: 'video/quicktime', extension: 'mov', quality: 'high' },
  { value: 'wav', label: 'WAV (Audio Only)', mimeType: 'audio/wav', extension: 'wav' },
  { value: 'mp3', label: 'MP3 (Audio Only)', mimeType: 'audio/mp3', extension: 'mp3' },
  { value: 'ogg', label: 'OGG (Audio Only)', mimeType: 'audio/ogg', extension: 'ogg' },
];

const qualityOptions = [
  { value: 'low', label: 'Low (480p)', bitrate: '500kbps' },
  { value: 'medium', label: 'Medium (720p)', bitrate: '1.5Mbps' },
  { value: 'high', label: 'High (1080p)', bitrate: '3Mbps' },
  { value: 'ultra', label: 'Ultra (1440p)', bitrate: '6Mbps' },
];

const FormatSettings = ({
  selectedFormat,
  onFormatChange,
  includeAudio,
  onAudioToggle,
  quality,
  onQualityChange,
  disabled = false
}: FormatSettingsProps) => {
  const [mp4Supported, setMp4Supported] = useState(false);

  useEffect(() => {
    setMp4Supported(isMp4Supported());
  }, []);

  // Filter/disable unavailable formats
  const formatOptions: FormatOption[] = rawFormatOptions.map(option => {
    if (option.value === "mp4-h264") {
      return { ...option, disabled: !mp4Supported };
    }
    return option;
  });

  const selectedFormatOption = formatOptions.find(f => f.value === selectedFormat);
  const isAudioOnly = selectedFormatOption?.value.includes('wav') ||
    selectedFormatOption?.value.includes('mp3') ||
    selectedFormatOption?.value.includes('ogg');

  // If MP4 not supported, show a warning in the UI
  const mp4Warning =
    selectedFormat === "mp4-h264" && !mp4Supported
      ? "⚠️ Your browser does not support MP4 recording. The file may not be compatible with WhatsApp. Use a supported browser or select WebM (VP8/VP9)."
      : "";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Recording Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Output Format
          </label>
          <Select value={selectedFormat} onValueChange={onFormatChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Video Formats</div>
              {formatOptions.filter(f => !f.value.includes('wav') && !f.value.includes('mp3') && !f.value.includes('ogg')).map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  <div className="flex justify-between items-center w-full">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{option.extension.toUpperCase()}</span>
                  </div>
                </SelectItem>
              ))}
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Audio Only</div>
              {formatOptions.filter(f => f.value.includes('wav') || f.value.includes('mp3') || f.value.includes('ogg')).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex justify-between items-center w-full">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{option.extension.toUpperCase()}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            💡 MP4 format is <strong>only available if your browser supports it</strong>. Recommended for WhatsApp if available.
          </p>
          {mp4Warning && (
            <div className="mt-2 px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">
              {mp4Warning}
            </div>
          )}
        </div>

        {/* Quality Selection - Only for video formats */}
        {!isAudioOnly && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Video Quality
            </label>
            <Select value={quality} onValueChange={onQualityChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                {qualityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex justify-between items-center w-full">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{option.bitrate}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Audio Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Include Audio
          </label>
          <Switch
            checked={includeAudio}
            onCheckedChange={onAudioToggle}
            disabled={disabled}
          />
        </div>

        {/* Format Info */}
        {selectedFormatOption && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            <strong>Selected:</strong> {selectedFormatOption.label}<br />
            <strong>Extension:</strong> .{selectedFormatOption.extension}<br />
            {!isAudioOnly && <><strong>Quality:</strong> {qualityOptions.find(q => q.value === quality)?.label}</>}
            {selectedFormatOption.value === 'mp4-h264' && mp4Supported && (
              <div className="text-green-600 font-medium mt-1">✓ WhatsApp Compatible</div>
            )}
            {selectedFormatOption.value === 'mp4-h264' && !mp4Supported && (
              <div className="text-yellow-800 font-medium mt-1">⚠️ Not supported in this browser</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { rawFormatOptions as formatOptions };
export default FormatSettings;
