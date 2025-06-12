
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface FormatOption {
  value: string;
  label: string;
  mimeType: string;
  extension: string;
  quality?: string;
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

const formatOptions: FormatOption[] = [
  { value: 'webm-vp9', label: 'WebM (VP9)', mimeType: 'video/webm; codecs=vp9', extension: 'webm', quality: 'high' },
  { value: 'webm-vp8', label: 'WebM (VP8)', mimeType: 'video/webm; codecs=vp8', extension: 'webm', quality: 'medium' },
  { value: 'mp4-h264', label: 'MP4 (H.264)', mimeType: 'video/mp4', extension: 'mp4', quality: 'high' },
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
  const selectedFormatOption = formatOptions.find(f => f.value === selectedFormat);
  const isAudioOnly = selectedFormatOption?.value.includes('wav') || 
                     selectedFormatOption?.value.includes('mp3') || 
                     selectedFormatOption?.value.includes('ogg');

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
                <SelectItem key={option.value} value={option.value}>
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
            <strong>Selected:</strong> {selectedFormatOption.label}<br/>
            <strong>Extension:</strong> .{selectedFormatOption.extension}<br/>
            {!isAudioOnly && <><strong>Quality:</strong> {qualityOptions.find(q => q.value === quality)?.label}</>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { formatOptions };
export default FormatSettings;
