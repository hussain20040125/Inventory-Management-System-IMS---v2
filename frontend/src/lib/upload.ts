import imageCompression from 'browser-image-compression';
import { instance } from '../services/api';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export interface UploadProgress {
  fileName: string;
  progress: number;
}

/**
 * Compresses an image file before upload.
 * Resizes to max 1024px and aims for < 500KB.
 */
export const compressImage = async (file: File) => {
  const options = {
    maxSizeMB: 0.5, // 500KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp' // WebP offers superior compression
  };

  try {
    // Only compress standard web image formats. 
    // HEIC/HEIF are skipped for compression here but will be handled by Cloudinary on the server.
    const isStandardImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
    if (!isStandardImage) return file;
    
    const compressedBlob = await imageCompression(file, options);
    // Return as a new File object with .webp extension
    const fileName = file.name.split('.').slice(0, -1).join('.') + '.webp';
    try {
      // Some environments restrict the File constructor
      if (typeof window !== 'undefined' && (window as any).File && typeof (window as any).File === 'function') {
        try {
          return new (window as any).File([compressedBlob], fileName, { type: 'image/webp' });
        } catch (innerError) {
          // If "Illegal constructor", fall through to fallback
          console.warn("Native File constructor failed, using fallback");
        }
      }
      
      // Fallback: create a blob and decorate it to look like a File
      const blob = compressedBlob as any;
      blob.lastModifiedDate = new Date();
      blob.name = fileName;
      blob.lastModified = Date.now();
      return blob as File;
    } catch (e) {
      console.error("File creation exception:", e);
      return compressedBlob as any as File;
    }
  } catch (error) {
    console.error('Compression failed, using original file:', error);
    return file;
  }
};

/**
 * Uploads a single file using the backend API which handles Cloudinary securely.
 */
export const uploadToCloudinary = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await instance.post(
      `public/upload`,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        }
      }
    );

    if (response.data && response.data.success) {
      return response.data.data.url;
    } else {
      const errorMsg = response.data?.message || `Server returned success:false (Status: ${response.status})`;
      console.error('Public upload failed details:', {
        status: response.status,
        data: response.data,
        error: errorMsg
      });
      throw new Error(errorMsg);
    }
  } catch (error: any) {
    console.error('Backend upload failed:', error);
    const serverMessage = error.response?.data?.message;
    const axiosMessage = error.message;
    const finalMessage = serverMessage || axiosMessage || 'Upload failed';
    throw new Error(finalMessage);
  }
};

/**
 * Handles parallel uploads for multiple files with compression.
 */
export const uploadMultipleImages = async (
  files: File[],
  onProgress?: (progress: UploadProgress[]) => void
): Promise<string[]> => {
  const progressMap = new Map<string, number>();
  files.forEach(f => progressMap.set(f.name, 0));

  const uploadPromises = files.map(async (file) => {
    try {
      // 1. Compress
      const compressed = await compressImage(file);
      
      // 2. Upload
      const url = await uploadToCloudinary(compressed as File, (progress) => {
        progressMap.set(file.name, progress);
        if (onProgress) {
          onProgress(Array.from(progressMap.entries()).map(([fileName, progress]) => ({ fileName, progress })));
        }
      });
      
      return url;
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      throw error;
    }
  });

  // Parallel execution for maximum speed
  return Promise.all(uploadPromises);
};
