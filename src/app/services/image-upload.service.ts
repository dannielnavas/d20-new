import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

interface UploadImageResponse {
  url: string;
}

interface UploadImageError {
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly maxImageBytes = 6 * 1024 * 1024;

  async uploadImage(file: File, folder?: string): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen');
    }

    if (file.size > this.maxImageBytes) {
      throw new Error('La imagen supera el limite de 6MB');
    }

    const dataUrl = await this.readAsDataUrl(file);

    const response = await fetch(`${environment.apiUrl}/uploads/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataUrl, folder }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as UploadImageError | null;
      throw new Error(payload?.message ?? 'No se pudo subir la imagen');
    }

    const payload = (await response.json()) as UploadImageResponse;
    if (!payload.url) {
      throw new Error('Respuesta de upload invalida');
    }

    return payload.url;
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('No se pudo leer la imagen'));
          return;
        }

        resolve(result);
      };
      reader.onerror = () => {
        reject(new Error('No se pudo leer la imagen'));
      };
      reader.readAsDataURL(file);
    });
  }
}
