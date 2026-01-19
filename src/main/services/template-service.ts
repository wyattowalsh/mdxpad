/**
 * Template Service - Main Process (Re-export)
 *
 * Feature: 016-template-library
 *
 * This file re-exports from the modular template service implementation.
 * The actual implementation is split across multiple files in ./template/
 * to comply with Constitution Article VI.2 (files < 400 lines).
 *
 * @module template-service
 */

export { registerTemplateHandlers } from './template/index';
