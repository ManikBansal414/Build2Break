import { ValidationResult } from '../types';

export class ValidationService {
  // Email validation
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Phone validation (basic international format)
  static validatePhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // Text content validation (prevent potential injection)
  static sanitizeText(text: string): string {
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  // Resume text validation
  static validateResumeText(resumeText: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!resumeText || resumeText.trim().length === 0) {
      errors.push('Resume text cannot be empty');
    }

    if (resumeText.length < 50) {
      warnings.push('Resume text seems very short (less than 50 characters)');
    }

    if (resumeText.length > 50000) {
      errors.push('Resume text is too long (maximum 50,000 characters)');
    }

    // Check for potential malicious content
    const suspiciousPatterns = [
      /javascript:/gi,
      /<script/gi,
      /eval\(/gi,
      /document\./gi,
      /window\./gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(resumeText)) {
        errors.push('Resume contains potentially malicious content');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Job description validation
  static validateJobDescription(jobDescription: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!jobDescription || jobDescription.trim().length === 0) {
      errors.push('Job description cannot be empty');
    }

    if (jobDescription.length < 20) {
      warnings.push('Job description seems very short');
    }

    if (jobDescription.length > 10000) {
      errors.push('Job description is too long (maximum 10,000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // File validation
  static validateFile(file: File): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      errors.push('File size exceeds 5MB limit');
    }

    // Check file type
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      warnings.push('File type may not be supported. Recommended: .txt, .pdf, .doc, .docx');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Name validation
  static validateName(name: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push('Name cannot be empty');
    }

    if (name.length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (name.length > 100) {
      errors.push('Name is too long (maximum 100 characters)');
    }

    // Check for valid name characters
    const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
    if (!nameRegex.test(name)) {
      errors.push('Name contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Role validation
  static validateRole(role: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!role || role.trim().length === 0) {
      errors.push('Role cannot be empty');
    }

    if (role.length < 2) {
      errors.push('Role must be at least 2 characters long');
    }

    if (role.length > 200) {
      errors.push('Role is too long (maximum 200 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Team validation
  static validateTeam(team: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!team || team.trim().length === 0) {
      errors.push('Team cannot be empty');
    }

    if (team.length > 100) {
      errors.push('Team name is too long (maximum 100 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Chat message validation
  static validateChatMessage(message: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!message || message.trim().length === 0) {
      errors.push('Message cannot be empty');
    }

    if (message.length > 5000) {
      errors.push('Message is too long (maximum 5,000 characters)');
    }

    // Check for potential prompt injection
    const injectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /forget\s+everything/gi,
      /you\s+are\s+now/gi,
      /new\s+role:/gi,
      /system\s*:/gi,
      /\[INST\]/gi
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(message)) {
        warnings.push('Message may contain prompt injection attempts');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}