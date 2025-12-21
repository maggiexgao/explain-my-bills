import { useCallback, useState } from 'react';
import { Upload, FileText, Image, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';
import { useHeicConverter } from '@/hooks/useHeicConverter';
import { useTranslation } from '@/i18n/LanguageContext';

interface FileUploaderProps {
  onFileSelect: (file: UploadedFile) => void;
  uploadedFile: UploadedFile | null;
  onRemoveFile: () => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
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
  const { convertFile, isConverting } = useHeicConverter();
  const { t } = useTranslation();

  const validateFile = (file: File): string | null => {
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

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const fileType = isPdf ? 'pdf' : 'image';
    
    const conversionResult = await convertFile(file);
    
    onFileSelect({
      id: crypto.randomUUID(),
      file,
      preview: conversionResult.originalUrl,
      previewUrl: conversionResult.previewUrl,
      originalUrl: conversionResult.originalUrl,
      type: fileType,
      isConverted: conversionResult.isConverted,
      conversionError: conversionResult.conversionError,
    });
  }, [onFileSelect, convertFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
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
    if (file) processFile(file);
  }, [processFile]);

  if (isConverting) {
    return (
      <div className="animate-scale-in">
        <div className="relative rounded-2xl border-2 border-primary/40 bg-primary/10 backdrop-blur-sm p-8">
          <div className="flex items-center justify-center gap-4">
            <div className="liquid-loader rounded-full p-3">
              <Loader2 className="h-8 w-8 text-primary-foreground animate-spin" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t('heic.converting')}</p>
              <p className="text-sm text-muted-foreground">{t('analysis.loadingDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (uploadedFile) {
    return (
      <div className="animate-scale-in">
        <div className="relative rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm p-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemoveFile}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl accent-gradient shadow-glow">
              {uploadedFile.type === 'pdf' ? (
                <FileText className="h-7 w-7 text-primary-foreground" />
              ) : (
                <Image className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {uploadedFile.file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB • {uploadedFile.type.toUpperCase()}
                {uploadedFile.isConverted && <span className="text-success ml-2">• Converted</span>}
              </p>
              {uploadedFile.conversionError && (
                <p className="text-xs text-warning mt-1">{uploadedFile.conversionError}</p>
              )}
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
          "relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10 shadow-glow-active scale-[1.02]"
            : "border-border/60 hover:border-primary/50 hover:bg-primary/5",
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
            "flex h-16 w-16 items-center justify-center rounded-2xl mb-4 transition-all duration-300",
            isDragging 
              ? "accent-gradient shadow-glow scale-110" 
              : "bg-muted/50"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-all duration-300",
              isDragging ? "text-primary-foreground" : "text-muted-foreground"
            )} />
          </div>
          
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {isDragging ? t('upload.bill.dragDrop') : t('upload.bill.title')}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('upload.bill.subtitle')}
          </p>
          <p className="text-xs text-muted-foreground/80">
            {t('upload.bill.formats')}
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