import { useCallback } from 'react';
import { Upload, FileCheck, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';

interface EOBUploaderProps {
  uploadedFile: UploadedFile | null;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export function EOBUploader({ uploadedFile, onFileSelect, onRemoveFile }: EOBUploaderProps) {
  const processFile = useCallback(
    (file: File) => {
      const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
      const preview = URL.createObjectURL(file);
      const uploadedFile: UploadedFile = {
        id: crypto.randomUUID(),
        file,
        preview,
        type: fileType,
      };
      onFileSelect(uploadedFile);
    },
    [onFileSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  if (uploadedFile) {
    return (
      <div className="p-4 rounded-xl border-2 border-success/30 bg-success/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
            <FileCheck className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {uploadedFile.file.name}
            </p>
            <p className="text-xs text-success">
              EOB uploaded - analysis will be enhanced
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemoveFile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30 transition-all">
      <label className="cursor-pointer">
        <input
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Upload Insurance EOB <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <p className="text-xs text-muted-foreground">
              For a more accurate breakdown of what insurance paid
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <span>
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </span>
          </Button>
        </div>
      </label>
    </div>
  );
}
