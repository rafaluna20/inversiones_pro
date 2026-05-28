// Validadores de archivos
export const fileValidators = {
  // Tipos de imagen permitidos
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  
  // Tamaño máximo: 5MB
  maxImageSize: 5 * 1024 * 1024,

  validateImage: (file: File): { valid: boolean; error?: string } => {
    if (!fileValidators.allowedImageTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Formato de imagen no válido. Solo se permiten JPG, PNG y WEBP.',
      };
    }

    if (file.size > fileValidators.maxImageSize) {
      return {
        valid: false,
        error: 'La imagen es demasiado grande. Máximo 5MB.',
      };
    }

    return { valid: true };
  },

  validateMultipleImages: (
    files: FileList | File[],
    maxFiles: number = 5
  ): { valid: boolean; error?: string } => {
    if (files.length > maxFiles) {
      return {
        valid: false,
        error: `Solo puedes subir máximo ${maxFiles} imágenes.`,
      };
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i] instanceof File ? files[i] : (files as FileList)[i];
      const validation = fileValidators.validateImage(file);
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  },
};

// Validador de email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return emailRegex.test(email);
};

// Validador de teléfono peruano
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(\+51)?[9]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Sanitizar HTML (para prevenir XSS)
export const sanitizeHTML = (html: string): string => {
  // Remover tags peligrosos
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
};

// Validador de monto
export const isValidAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && num < 1000000000;
};

// Rate limiter simple (client-side)
export class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  canProceed(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const userTimestamps = this.timestamps.get(key) || [];
    
    // Filtrar timestamps antiguos
    const recentTimestamps = userTimestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (recentTimestamps.length >= limit) {
      return false;
    }

    recentTimestamps.push(now);
    this.timestamps.set(key, recentTimestamps);
    return true;
  }

  reset(key: string): void {
    this.timestamps.delete(key);
  }
}

// Instancia global del rate limiter
export const rateLimiter = new RateLimiter();
