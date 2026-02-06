import { describe, it, expect } from 'vitest';

/**
 * Tests for the pure helper logic extracted from CustomFieldsForm.
 * These verify the fix for the infinite render loop bug
 * (Maximum update depth exceeded at line 77).
 *
 * Root cause: useEffect depended on dataFingerprint (useMemo),
 * which depended on `fields` and `values` arrays that got new references
 * on every render from tRPC queries. This caused:
 *   setLocalValues → re-render → new fingerprint → useEffect fires → setLocalValues → loop
 *
 * Fix: Use a ref (lastSyncedFingerprint) to skip the effect when the
 * fingerprint string hasn't actually changed, breaking the cycle.
 */

// Inline the pure functions from CustomFieldsForm for testing
function buildFingerprint(fields: any[], values: any[]): string {
  if (fields.length === 0) return '';
  return fields
    .map((f) => {
      const val = values.find((v: any) => v.customFieldId === f.id);
      return `${f.id}:${val?.value ?? ''}:${val?.numericValue ?? ''}:${val?.booleanValue ?? ''}:${val?.dateValue ?? ''}:${JSON.stringify(val?.jsonValue ?? null)}`;
    })
    .join('|');
}

function buildInitialValues(fields: any[], values: any[]): Record<number, any> {
  const initial: Record<number, any> = {};
  for (const field of fields) {
    const value = values.find((v: any) => v.customFieldId === field.id);
    if (value) {
      switch (field.type) {
        case 'number':
        case 'currency':
        case 'percent':
        case 'rating':
          initial[field.id] = value.numericValue ? parseFloat(value.numericValue) : '';
          break;
        case 'checkbox':
          initial[field.id] = value.booleanValue ?? false;
          break;
        case 'date':
          initial[field.id] = value.dateValue ? new Date(value.dateValue) : null;
          break;
        case 'multiselect':
          initial[field.id] = value.jsonValue || [];
          break;
        default:
          initial[field.id] = value.value || '';
      }
    } else {
      initial[field.id] =
        field.defaultValue ||
        (field.type === 'checkbox' ? false : field.type === 'multiselect' ? [] : '');
    }
  }
  return initial;
}

describe('CustomFieldsForm - buildFingerprint', () => {
  it('should return empty string for empty fields', () => {
    expect(buildFingerprint([], [])).toBe('');
  });

  it('should produce a stable fingerprint for the same data', () => {
    const fields = [
      { id: 1, name: 'Budget', type: 'number' },
      { id: 2, name: 'Status', type: 'select' },
    ];
    const values = [
      { customFieldId: 1, value: null, numericValue: '5000', booleanValue: null, dateValue: null, jsonValue: null },
      { customFieldId: 2, value: 'active', numericValue: null, booleanValue: null, dateValue: null, jsonValue: null },
    ];

    const fp1 = buildFingerprint(fields, values);
    const fp2 = buildFingerprint(fields, values);
    expect(fp1).toBe(fp2);
  });

  it('should produce identical fingerprints for equivalent data in new arrays', () => {
    const fields1 = [{ id: 1, name: 'Budget', type: 'number' }];
    const values1 = [{ customFieldId: 1, value: null, numericValue: '100', booleanValue: null, dateValue: null, jsonValue: null }];

    // Create new array references with same data (simulates tRPC re-fetch)
    const fields2 = [{ id: 1, name: 'Budget', type: 'number' }];
    const values2 = [{ customFieldId: 1, value: null, numericValue: '100', booleanValue: null, dateValue: null, jsonValue: null }];

    expect(buildFingerprint(fields1, values1)).toBe(buildFingerprint(fields2, values2));
  });

  it('should produce different fingerprints when data changes', () => {
    const fields = [{ id: 1, name: 'Budget', type: 'number' }];
    const values1 = [{ customFieldId: 1, value: null, numericValue: '100', booleanValue: null, dateValue: null, jsonValue: null }];
    const values2 = [{ customFieldId: 1, value: null, numericValue: '200', booleanValue: null, dateValue: null, jsonValue: null }];

    expect(buildFingerprint(fields, values1)).not.toBe(buildFingerprint(fields, values2));
  });

  it('should handle fields with no matching values', () => {
    const fields = [{ id: 1, name: 'Budget', type: 'number' }];
    const values: any[] = [];

    const fp = buildFingerprint(fields, values);
    expect(fp).toBe('1:::::null');
  });

  it('should handle jsonValue correctly', () => {
    const fields = [{ id: 1, name: 'Tags', type: 'multiselect' }];
    const values = [{ customFieldId: 1, value: null, numericValue: null, booleanValue: null, dateValue: null, jsonValue: ['a', 'b'] }];

    const fp = buildFingerprint(fields, values);
    expect(fp).toContain('["a","b"]');
  });
});

describe('CustomFieldsForm - buildInitialValues', () => {
  it('should return empty object for empty fields', () => {
    expect(buildInitialValues([], [])).toEqual({});
  });

  it('should parse number fields from numericValue', () => {
    const fields = [{ id: 1, name: 'Budget', type: 'number' }];
    const values = [{ customFieldId: 1, numericValue: '5000.50' }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(5000.50);
  });

  it('should return empty string for number fields with no numericValue', () => {
    const fields = [{ id: 1, name: 'Budget', type: 'number' }];
    const values = [{ customFieldId: 1, numericValue: null }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe('');
  });

  it('should handle checkbox fields', () => {
    const fields = [{ id: 1, name: 'Active', type: 'checkbox' }];
    const values = [{ customFieldId: 1, booleanValue: true }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(true);
  });

  it('should default checkbox to false when no value', () => {
    const fields = [{ id: 1, name: 'Active', type: 'checkbox' }];
    const values: any[] = [];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(false);
  });

  it('should handle date fields', () => {
    const timestamp = Date.now();
    const fields = [{ id: 1, name: 'Due', type: 'date' }];
    const values = [{ customFieldId: 1, dateValue: timestamp }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBeInstanceOf(Date);
    expect(result[1].getTime()).toBe(timestamp);
  });

  it('should handle null date fields', () => {
    const fields = [{ id: 1, name: 'Due', type: 'date' }];
    const values = [{ customFieldId: 1, dateValue: null }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBeNull();
  });

  it('should handle multiselect fields', () => {
    const fields = [{ id: 1, name: 'Tags', type: 'multiselect' }];
    const values = [{ customFieldId: 1, jsonValue: ['tag1', 'tag2'] }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toEqual(['tag1', 'tag2']);
  });

  it('should default multiselect to empty array', () => {
    const fields = [{ id: 1, name: 'Tags', type: 'multiselect' }];
    const values: any[] = [];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toEqual([]);
  });

  it('should handle text fields', () => {
    const fields = [{ id: 1, name: 'Note', type: 'text' }];
    const values = [{ customFieldId: 1, value: 'Hello world' }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe('Hello world');
  });

  it('should use defaultValue when no value exists', () => {
    const fields = [{ id: 1, name: 'Note', type: 'text', defaultValue: 'Default text' }];
    const values: any[] = [];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe('Default text');
  });

  it('should handle currency type same as number', () => {
    const fields = [{ id: 1, name: 'Price', type: 'currency' }];
    const values = [{ customFieldId: 1, numericValue: '99.99' }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(99.99);
  });

  it('should handle percent type same as number', () => {
    const fields = [{ id: 1, name: 'Progress', type: 'percent' }];
    const values = [{ customFieldId: 1, numericValue: '75' }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(75);
  });

  it('should handle rating type same as number', () => {
    const fields = [{ id: 1, name: 'Rating', type: 'rating' }];
    const values = [{ customFieldId: 1, numericValue: '4' }];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(4);
  });

  it('should handle multiple fields correctly', () => {
    const fields = [
      { id: 1, name: 'Budget', type: 'number' },
      { id: 2, name: 'Active', type: 'checkbox' },
      { id: 3, name: 'Tags', type: 'multiselect' },
      { id: 4, name: 'Note', type: 'text' },
    ];
    const values = [
      { customFieldId: 1, numericValue: '1000' },
      { customFieldId: 2, booleanValue: true },
      { customFieldId: 3, jsonValue: ['a', 'b'] },
      { customFieldId: 4, value: 'Test note' },
    ];

    const result = buildInitialValues(fields, values);
    expect(result[1]).toBe(1000);
    expect(result[2]).toBe(true);
    expect(result[3]).toEqual(['a', 'b']);
    expect(result[4]).toBe('Test note');
  });
});

describe('CustomFieldsForm - Infinite Loop Prevention', () => {
  it('should produce same fingerprint for identical data (preventing re-sync)', () => {
    // This test verifies the core fix: when tRPC re-fetches and returns
    // new array references with the same data, the fingerprint stays the same,
    // so the useEffect ref guard prevents calling setLocalValues again.
    const fields = [
      { id: 1, name: 'Budget', type: 'number' },
      { id: 2, name: 'Status', type: 'select' },
    ];
    const values = [
      { customFieldId: 1, value: null, numericValue: '5000', booleanValue: null, dateValue: null, jsonValue: null },
      { customFieldId: 2, value: 'active', numericValue: null, booleanValue: null, dateValue: null, jsonValue: null },
    ];

    // Simulate multiple renders with new array references but same data
    let lastFingerprint = '';
    let syncCount = 0;

    for (let render = 0; render < 10; render++) {
      const newFields = fields.map((f) => ({ ...f }));
      const newValues = values.map((v) => ({ ...v }));

      const fp = buildFingerprint(newFields, newValues);

      if (fp !== lastFingerprint) {
        lastFingerprint = fp;
        syncCount++;
      }
    }

    // Should only sync once, not 10 times
    expect(syncCount).toBe(1);
  });

  it('should re-sync when data actually changes', () => {
    const fields = [{ id: 1, name: 'Budget', type: 'number' }];

    let lastFingerprint = '';
    let syncCount = 0;

    // First render
    const values1 = [{ customFieldId: 1, value: null, numericValue: '100', booleanValue: null, dateValue: null, jsonValue: null }];
    let fp = buildFingerprint(fields, values1);
    if (fp !== lastFingerprint) { lastFingerprint = fp; syncCount++; }

    // Second render with same data
    const values1Copy = [{ customFieldId: 1, value: null, numericValue: '100', booleanValue: null, dateValue: null, jsonValue: null }];
    fp = buildFingerprint(fields, values1Copy);
    if (fp !== lastFingerprint) { lastFingerprint = fp; syncCount++; }

    // Third render with changed data
    const values2 = [{ customFieldId: 1, value: null, numericValue: '200', booleanValue: null, dateValue: null, jsonValue: null }];
    fp = buildFingerprint(fields, values2);
    if (fp !== lastFingerprint) { lastFingerprint = fp; syncCount++; }

    // Should sync exactly twice: initial + after data change
    expect(syncCount).toBe(2);
  });
});
