import { useCallback, useState } from 'react';
import { Upload, FileText, Image, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';

interface FileUploaderProps {
  onFileSelect: (file: UploadedFile) => void;
  uploadedFile: UploadedFile | null;
  onRemoveFile: () => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/heif',
];
const ACCEPTED_TYPES = ['application/pdf', ...ACCEPTED_IMAGE_TYPES];

export function FileUploader({ onFileSelect, uploadedFile, onRemoveFile }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    // Check file extension for HEIC files (browser may not recognize MIME type)
    const fileName = file.name.toLowerCase();
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif');
    const isAcceptedByType = ACCEPTED_TYPES.includes(file.type);
    const isAcceptedByExtension = /\.(pdf|jpe?g|png|gif|webp|tiff?|bmp|heic|heif)$/i.test(fileName);
    
    if (!isAcceptedByType && !isAcceptedByExtension && !isHeic) {
      return 'Please upload a PDF or image file (JPG, PNG, GIF, WEBP, TIFF, BMP, or HEIC).';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 20MB.';
    }
    return null;
  };

  const processFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const fileType = isPdf ? 'pdf' : 'image';
    const preview = URL.createObjectURL(file);
    
    onFileSelect({
      id: crypto.randomUUID(),
      file,
      preview,
      type: fileType,
    });
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  if (uploadedFile) {
    return (
      <div className="animate-scale-in">
        <div className="relative rounded-xl border-2 border-primary/30 bg-primary-light/30 p-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemoveFile}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
              {uploadedFile.type === 'pdf' ? (
                <FileText className="h-7 w-7 text-primary" />
              ) : (
                <Image className="h-7 w-7 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {uploadedFile.file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB • {uploadedFile.type.toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
          "hover:border-primary/50 hover:bg-primary-light/20",
          isDragging
            ? "border-primary bg-primary-light/30 scale-[1.02]"
            : "border-border bg-card",
          error && "border-destructive/50"
        )}
      >
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.tif,.bmp,.heic,.heif"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl mb-4 transition-colors",
            isDragging ? "bg-primary/20" : "bg-muted"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          
          <h3 className="text-lg font-medium text-foreground mb-1">
            {isDragging ? 'Drop your file here' : 'Upload your document'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PDF or images (JPG, PNG, HEIC, GIF, WEBP, TIFF, BMP) • Maximum 20MB
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
