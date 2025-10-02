import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { FaUpload, FaFile, FaTrash } from 'react-icons/fa';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // en bytes
  label?: string;
  error?: string;
}

export const FileUpload = ({
  onFileSelect,
  accept = '.csv,.xlsx,.xls',
  maxSize = 10 * 1024 * 1024, // 10MB por defecto
  label = 'Selecciona o arrastra un archivo',
  error,
}: FileUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    validateAndSetFile(selectedFile);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const selectedFile = e.dataTransfer.files?.[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile: File | undefined) => {
    if (!selectedFile) return;

    setFileError(null);

    // Validar tipo de archivo
    const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
    const acceptedTypes = accept.split(',').map(type => 
      type.startsWith('.') ? type.substring(1) : type
    );
    
    if (!acceptedTypes.includes(fileType || '')) {
      setFileError(`Tipo de archivo no permitido. Use: ${accept}`);
      return;
    }

    // Validar tamaño
    if (selectedFile.size > maxSize) {
      setFileError(`El archivo es demasiado grande. Máximo: ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    setFile(selectedFile);
    onFileSelect(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    setFileError(null);
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary'
          } ${error || fileError ? 'border-red-500' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <input
            id="fileInput"
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleFileChange}
          />
          <FaUpload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">{label}</p>
          <p className="text-xs text-gray-500 mt-1">
            Formatos permitidos: {accept}. Tamaño máximo: {maxSize / (1024 * 1024)}MB
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FaFile className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="text-gray-400 hover:text-red-500"
            >
              <FaTrash />
            </button>
          </div>
        </div>
      )}
      
      {(error || fileError) && (
        <p className="mt-1 text-sm text-red-600">{error || fileError}</p>
      )}
    </div>
  );
};
