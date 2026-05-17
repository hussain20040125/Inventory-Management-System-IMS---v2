import axios from 'axios';

const API_BASE = '/api';

export const instance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

instance.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  get: async (path: string, params?: any) => {
    const res = await instance.get(path, { params });
    return res.data;
  },
  post: async (path: string, data: any) => {
    try {
      const config: any = {};
      const res = await instance.post(path, data, config);
      return res.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Request failed';
      throw new Error(message);
    }
  },
  put: async (path: string, id: string, data: any) => {
    try {
      const res = await instance.put(`${path}/${encodeURIComponent(id)}`, data);
      return res.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Update failed';
      throw new Error(message);
    }
  },
  putSimple: async (path: string, data: any) => {
    try {
      const res = await instance.put(path, data);
      return res.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Update failed';
      throw new Error(message);
    }
  },
  patch: async (path: string, data: any) => {
    try {
      const res = await instance.patch(path, data);
      return res.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Update failed';
      throw new Error(message);
    }
  },
  delete: async (path: string, id: string) => {
    try {
      const res = await instance.delete(`${path}/${encodeURIComponent(id)}`);
      return res.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Deletion failed';
      throw new Error(message);
    }
  },
  seed: async (seedData: any) => {
    const res = await instance.post('seed', seedData);
    return res.data;
  },
  upload: async (file: File, path: string = 'upload') => {
    // Try direct Cloudinary upload first if configured
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (cloudName && uploadPreset && !cloudName.includes('your_') && !uploadPreset.includes('your_')) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          formData
        );
        return { url: res.data.secure_url };
      } catch (error: any) {
        console.warn('Direct Cloudinary upload failed, falling back to backend:', error);
        // Fallback to backend if direct fails
      }
    }

    const formData = new FormData();
    formData.append('image', file, file.name);

    // Let axios set the Content-Type header with the correct boundary
    try {
      const res = await instance.post(path, formData);
      
      // Basic sanity check to ensure we got a JSON response and not an HTML fallback
      if (typeof res.data === 'string' && res.data.trim().startsWith('<!DOCTYPE html>')) {
        throw new Error('Server returned HTML instead of JSON. The API endpoint might be configured incorrectly.');
      }

      console.log(`[API] Upload response for ${path}:`, {
        status: res.status,
        data: res.data
      });

      const success = res.data?.success !== false;
      const url = res.data?.data?.url || res.data?.url || res.data?.secure_url;

      if (!res.data || (!success && !url)) {
        const errorMsg = res.data?.message || `Server returned success:false (Status: ${res.status})`;
        console.error('Upload failed details:', {
          status: res.status,
          data: res.data,
          error: errorMsg
        });
        throw new Error(errorMsg);
      }
      
      return { url: url || "" };
    } catch (error: any) {
      console.error('API Upload Exception:', error);
      const serverMessage = error.response?.data?.message;
      const axiosMessage = error.message;
      const finalMessage = serverMessage || axiosMessage || 'Upload failed';
      throw new Error(finalMessage);
    }
  }
};
