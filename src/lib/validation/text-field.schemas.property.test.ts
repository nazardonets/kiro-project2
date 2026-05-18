import fc from 'fast-check';
import { describe, it } from 'vitest';

import { validateTextField, TEXT_FIELD_CONFIGS, TextFieldConfig } from './text-field.schemas';

/**
 * **Validates: Requirements 9.4, 11.2, 11.3, 11.5, 6.3, 6.5, 5.4**
 *
 * Property 21: Text Field Length Validation
 * For any text input to a length-constrained field, the system SHALL accept the input
 * if and only if its length falls within the specified bounds.
 */

const fieldConfigs: { key: string; config: TextFieldConfig }[] = [
  { key: 'personalNotes', config: TEXT_FIELD_CONFIGS.personalNotes },
  { key: 'location', config: TEXT_FIELD_CONFIGS.location },
  { key: 'mood', config: TEXT_FIELD_CONFIGS.mood },
  { key: 'annotation', config: TEXT_FIELD_CONFIGS.annotation },
  { key: 'override', config: TEXT_FIELD_CONFIGS.override },
  { key: 'suspensionReason', config: TEXT_FIELD_CONFIGS.suspensionReason },
  { key: 'behavioralPrompt', config: TEXT_FIELD_CONFIGS.behavioralPrompt },
];

describe('Property 21: Text Field Length Validation', () => {
  for (const { key, config } of fieldConfigs) {
    describe(`${key} (min: ${config.minLength}, max: ${config.maxLength})`, () => {
      it('accepts any string within valid length bounds', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: config.minLength, maxLength: config.maxLength }),
            (input) => {
              const result = validateTextField(input, config);
              return result.success === true && result.error === undefined;
            },
          ),
        );
      });

      it('rejects any string exceeding the max length', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: config.maxLength + 1, maxLength: config.maxLength + 500 }),
            (input) => {
              const result = validateTextField(input, config);
              return (
                result.success === false &&
                result.error?.constraint === 'max_length' &&
                result.error.message.includes(config.fieldName) &&
                result.error.message.includes(`at most ${config.maxLength}`)
              );
            },
          ),
        );
      });

      if (config.minLength > 0) {
        it('rejects empty strings for required fields', () => {
          fc.assert(
            fc.property(fc.constant(''), (input) => {
              const result = validateTextField(input, config);
              return (
                result.success === false &&
                result.error?.constraint === 'min_length' &&
                result.error.message.includes(config.fieldName) &&
                result.error.message.includes(`at least ${config.minLength}`)
              );
            }),
          );
        });
      }

      it('error messages correctly identify the constraint type', () => {
        fc.assert(
          fc.property(fc.string(), (input) => {
            const result = validateTextField(input, config);
            if (result.success) {
              // Valid input: length is within bounds
              return input.length >= config.minLength && input.length <= config.maxLength;
            } else {
              // Invalid input: error constraint matches the violation
              if (input.length < config.minLength) {
                return result.error?.constraint === 'min_length';
              }
              if (input.length > config.maxLength) {
                return result.error?.constraint === 'max_length';
              }
              // Should not reach here
              return false;
            }
          }),
        );
      });
    });
  }
});
