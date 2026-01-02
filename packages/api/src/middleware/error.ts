/**
 * Error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import type { ValidationErrorResponse, ValidationErrorDetail } from '../types.js';

/**
 * API Error class with suggestion support.
 */
export class APIError extends Error {
  statusCode: number;
  suggestion: string | undefined;

  constructor(message: string, statusCode = 500, suggestion?: string) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.suggestion = suggestion;
  }
}

/**
 * Not found error.
 */
export class NotFoundError extends APIError {
  constructor(resource: string, suggestion?: string) {
    super(`${resource} not found`, 404, suggestion);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error with detailed field errors.
 */
export class ValidationError extends APIError {
  validationErrors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message, 400);
    this.name = 'ValidationError';
    this.validationErrors = errors;
  }
}

/**
 * Bad request error for invalid input.
 */
export class BadRequestError extends APIError {
  constructor(message: string, suggestion?: string) {
    super(message, 400, suggestion);
    this.name = 'BadRequestError';
  }
}

/**
 * Error handling middleware.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('API Error:', err.message);

  if (err instanceof ValidationError) {
    const response: ValidationErrorResponse = {
      success: false,
      error: err.message,
      validationErrors: err.validationErrors,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  if (err instanceof APIError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.suggestion && { suggestion: err.suggestion }),
    });
    return;
  }

  // Unknown error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

/**
 * 404 handler for unknown routes.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    suggestion: 'Check the API documentation for available endpoints',
  });
}
