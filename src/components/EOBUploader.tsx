import { useCallback } from 'react';
import { Upload, FileCheck, X, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';
import { useHeicConverter } from '@/hooks/useHeicConverter';
import { useTranslation } from '@/i18n/LanguageContext';

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
  const { convertFile, isConverting } = useHeicConverter();
  const { t } = useTranslation();

  const processFile = useCallback(
    async (file: File) => {
      const fileName = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
      const fileType = isPdf ? 'pdf' : 'image';
      
      const conversionResult = await convertFile(file);
      
      const uploadedFileObj: UploadedFile = {
        id: crypto.randomUUID(),
        file,
        preview: conversionResult.originalUrl,
        previewUrl: conversionResult.previewUrl,
        originalUrl: conversionResult.originalUrl,
        type: fileType,
        isConverted: conversionResult.isConverted,
        conversionError: conversionResult.conversionError,
      };
      onFileSelect(uploadedFileObj);
    },
    [onFileSelect, convertFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  if (isConverting) {
    return (
      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="liquid-loader rounded-full p-2">
            <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
          </div>
          <p className="text-sm text-foreground">{t('heic.converting')}</p>
        </div>
      </div>
    );
  }

  if (uploadedFile) {
    return (
      <div className="p-4 rounded-xl border border-success/30 bg-success/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
            <FileCheck className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {uploadedFile.file.name}
            </p>
            <p className="text-xs text-success">
              EOB uploaded
              {uploadedFile.isConverted && ' • Converted'}
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
    <div className="p-4 rounded-xl border border-dashed border-border/50 bg-background/30 backdrop-blur-sm hover:border-primary/30 hover:bg-background/50 transition-all">
      <label className="cursor-pointer">
        <input
          type="file"
          className="sr-only"
          accept={[...ACCEPTED_TYPES, '.heic', '.heif'].join(',')}
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {t('upload.eob.title')} <span className="text-muted-foreground font-normal">({t('upload.eob.optional')})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('upload.eob.subtitle')}
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 border-border/50 bg-background/50 hover:bg-background/80" asChild>
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