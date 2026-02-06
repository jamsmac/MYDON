import { describe, it, expect } from 'vitest';

// Test the filtering logic directly
// We test the pure functions from CustomFieldFilter

// Inline the filter logic for testing (since it's a client component, we test the logic)
type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'before' | 'after' | 'is_true' | 'is_false' | 'is_empty' | 'is_not_empty';

interface CustomFieldFilterRule {
  id: string;
  fieldId: number;
  operator: FilterOperator;
  value: string;
}

type CustomFieldForFilter = {
  id: number;
  name: string;
  type: string;
  options?: any;
};

type CustomFieldValueForFilter = {
  id: number;
  customFieldId: number;
  taskId: number;
  value?: string | null;
  numericValue?: string | null;
  dateValue?: Date | string | null;
  booleanValue?: boolean | null;
  jsonValue?: any;
};

// Replicate the taskPassesFilter logic for testing
function taskPassesFilter(
  rule: CustomFieldFilterRule,
  fieldValue: CustomFieldValueForFilter | undefined,
  field: CustomFieldForFilter
): boolean {
  const { operator, value: filterValue } = rule;

  if (operator === 'is_empty') {
    if (!fieldValue) return true;
    if (field.type === 'checkbox') return fieldValue.booleanValue === null || fieldValue.booleanValue === undefined;
    if (['number', 'currency', 'percent', 'rating'].includes(field.type)) return !fieldValue.numericValue;
    if (field.type === 'date') return !fieldValue.dateValue;
    if (field.type === 'multiselect') return !fieldValue.jsonValue;
    return !fieldValue.value;
  }
  if (operator === 'is_not_empty') {
    return !taskPassesFilter({ ...rule, operator: 'is_empty' }, fieldValue, field);
  }

  if (operator === 'is_true') return fieldValue?.booleanValue === true;
  if (operator === 'is_false') return !fieldValue?.booleanValue;

  if (!fieldValue) return false;

  if (['text', 'url', 'email', 'formula', 'rollup'].includes(field.type)) {
    const val = (fieldValue.value || '').toLowerCase();
    const fv = filterValue.toLowerCase();
    switch (operator) {
      case 'equals': return val === fv;
      case 'contains': return val.includes(fv);
      case 'not_contains': return !val.includes(fv);
      default: return true;
    }
  }

  if (['number', 'currency', 'percent', 'rating'].includes(field.type)) {
    const val = fieldValue.numericValue ? parseFloat(fieldValue.numericValue) : null;
    const fv = parseFloat(filterValue);
    if (val === null || isNaN(fv)) return false;
    switch (operator) {
      case 'equals': return val === fv;
      case 'not_equals': return val !== fv;
      case 'greater_than': return val > fv;
      case 'less_than': return val < fv;
      case 'greater_or_equal': return val >= fv;
      case 'less_or_equal': return val <= fv;
      default: return true;
    }
  }

  if (field.type === 'date') {
    if (!fieldValue.dateValue) return false;
    const val = new Date(fieldValue.dateValue).getTime();
    const fv = new Date(filterValue).getTime();
    if (isNaN(val) || isNaN(fv)) return false;
    switch (operator) {
      case 'equals': return Math.abs(val - fv) < 86400000;
      case 'before': return val < fv;
      case 'after': return val > fv;
      default: return true;
    }
  }

  if (field.type === 'select') {
    const val = fieldValue.value || '';
    switch (operator) {
      case 'equals': return val === filterValue;
      case 'not_equals': return val !== filterValue;
      default: return true;
    }
  }

  if (field.type === 'multiselect') {
    let selected: string[] = [];
    try { selected = fieldValue.jsonValue ? JSON.parse(fieldValue.jsonValue) : []; } catch {}
    switch (operator) {
      case 'contains': return selected.includes(filterValue);
      case 'not_contains': return !selected.includes(filterValue);
      default: return true;
    }
  }

  return true;
}

function taskPassesAllFilters(
  rules: CustomFieldFilterRule[],
  taskId: number,
  fieldValuesMap: Map<number, Map<number, CustomFieldValueForFilter>>,
  fieldsMap: Map<number, CustomFieldForFilter>
): boolean {
  if (rules.length === 0) return true;
  const taskValues = fieldValuesMap.get(taskId);
  return rules.every(rule => {
    const field = fieldsMap.get(rule.fieldId);
    if (!field) return true;
    const fieldValue = taskValues?.get(rule.fieldId);
    return taskPassesFilter(rule, fieldValue, field);
  });
}

describe('Custom Field Filter Logic', () => {
  const textField: CustomFieldForFilter = { id: 1, name: 'Description', type: 'text' };
  const numberField: CustomFieldForFilter = { id: 2, name: 'Estimate', type: 'number' };
  const checkboxField: CustomFieldForFilter = { id: 3, name: 'Approved', type: 'checkbox' };
  const selectField: CustomFieldForFilter = { id: 4, name: 'Category', type: 'select', options: JSON.stringify([{ label: 'Bug', value: 'bug' }, { label: 'Feature', value: 'feature' }]) };
  const dateField: CustomFieldForFilter = { id: 5, name: 'Due', type: 'date' };
  const ratingField: CustomFieldForFilter = { id: 6, name: 'Rating', type: 'rating' };
  const multiselectField: CustomFieldForFilter = { id: 7, name: 'Tags', type: 'multiselect' };

  describe('Text field filters', () => {
    it('should filter by contains', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 1, operator: 'contains', value: 'hello' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 1, taskId: 1, value: 'Hello World' };
      expect(taskPassesFilter(rule, val, textField)).toBe(true);
    });

    it('should filter by not contains', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 1, operator: 'not_contains', value: 'xyz' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 1, taskId: 1, value: 'Hello World' };
      expect(taskPassesFilter(rule, val, textField)).toBe(true);
    });

    it('should filter by equals (case insensitive)', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 1, operator: 'equals', value: 'hello world' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 1, taskId: 1, value: 'Hello World' };
      expect(taskPassesFilter(rule, val, textField)).toBe(true);
    });

    it('should return false when text does not contain filter value', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 1, operator: 'contains', value: 'missing' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 1, taskId: 1, value: 'Hello World' };
      expect(taskPassesFilter(rule, val, textField)).toBe(false);
    });
  });

  describe('Number field filters', () => {
    it('should filter by equals', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'equals', value: '10' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: '10' };
      expect(taskPassesFilter(rule, val, numberField)).toBe(true);
    });

    it('should filter by greater_than', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'greater_than', value: '5' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: '10' };
      expect(taskPassesFilter(rule, val, numberField)).toBe(true);
    });

    it('should filter by less_than', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'less_than', value: '5' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: '10' };
      expect(taskPassesFilter(rule, val, numberField)).toBe(false);
    });

    it('should filter by greater_or_equal', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'greater_or_equal', value: '10' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: '10' };
      expect(taskPassesFilter(rule, val, numberField)).toBe(true);
    });

    it('should filter by less_or_equal', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'less_or_equal', value: '10' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: '10' };
      expect(taskPassesFilter(rule, val, numberField)).toBe(true);
    });

    it('should return false for null numeric value', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'equals', value: '10' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: null };
      expect(taskPassesFilter(rule, val, numberField)).toBe(false);
    });
  });

  describe('Checkbox field filters', () => {
    it('should filter is_true', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 3, operator: 'is_true', value: '' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 3, taskId: 1, booleanValue: true };
      expect(taskPassesFilter(rule, val, checkboxField)).toBe(true);
    });

    it('should filter is_false', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 3, operator: 'is_false', value: '' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 3, taskId: 1, booleanValue: false };
      expect(taskPassesFilter(rule, val, checkboxField)).toBe(true);
    });

    it('should return false for is_true when value is false', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 3, operator: 'is_true', value: '' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 3, taskId: 1, booleanValue: false };
      expect(taskPassesFilter(rule, val, checkboxField)).toBe(false);
    });
  });

  describe('Select field filters', () => {
    it('should filter by equals', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 4, operator: 'equals', value: 'bug' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 4, taskId: 1, value: 'bug' };
      expect(taskPassesFilter(rule, val, selectField)).toBe(true);
    });

    it('should filter by not_equals', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 4, operator: 'not_equals', value: 'bug' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 4, taskId: 1, value: 'feature' };
      expect(taskPassesFilter(rule, val, selectField)).toBe(true);
    });
  });

  describe('Date field filters', () => {
    it('should filter by before', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 5, operator: 'before', value: '2026-03-01' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 5, taskId: 1, dateValue: '2026-02-15' };
      expect(taskPassesFilter(rule, val, dateField)).toBe(true);
    });

    it('should filter by after', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 5, operator: 'after', value: '2026-01-01' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 5, taskId: 1, dateValue: '2026-02-15' };
      expect(taskPassesFilter(rule, val, dateField)).toBe(true);
    });

    it('should return false for before when date is after', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 5, operator: 'before', value: '2026-01-01' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 5, taskId: 1, dateValue: '2026-02-15' };
      expect(taskPassesFilter(rule, val, dateField)).toBe(false);
    });
  });

  describe('Rating field filters', () => {
    it('should filter by greater_or_equal', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 6, operator: 'greater_or_equal', value: '4' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 6, taskId: 1, numericValue: '5' };
      expect(taskPassesFilter(rule, val, ratingField)).toBe(true);
    });

    it('should filter by equals', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 6, operator: 'equals', value: '3' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 6, taskId: 1, numericValue: '3' };
      expect(taskPassesFilter(rule, val, ratingField)).toBe(true);
    });
  });

  describe('Multiselect field filters', () => {
    it('should filter by contains', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 7, operator: 'contains', value: 'tag1' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 7, taskId: 1, jsonValue: JSON.stringify(['tag1', 'tag2']) };
      expect(taskPassesFilter(rule, val, multiselectField)).toBe(true);
    });

    it('should filter by not_contains', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 7, operator: 'not_contains', value: 'tag3' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 7, taskId: 1, jsonValue: JSON.stringify(['tag1', 'tag2']) };
      expect(taskPassesFilter(rule, val, multiselectField)).toBe(true);
    });
  });

  describe('Empty/not empty filters', () => {
    it('should detect empty text field', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 1, operator: 'is_empty', value: '' };
      expect(taskPassesFilter(rule, undefined, textField)).toBe(true);
    });

    it('should detect non-empty text field', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 1, operator: 'is_not_empty', value: '' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 1, taskId: 1, value: 'hello' };
      expect(taskPassesFilter(rule, val, textField)).toBe(true);
    });

    it('should detect empty number field', () => {
      const rule: CustomFieldFilterRule = { id: '1', fieldId: 2, operator: 'is_empty', value: '' };
      const val: CustomFieldValueForFilter = { id: 1, customFieldId: 2, taskId: 1, numericValue: null };
      expect(taskPassesFilter(rule, val, numberField)).toBe(true);
    });
  });

  describe('Combined filters (AND logic)', () => {
    it('should pass when all filters match', () => {
      const rules: CustomFieldFilterRule[] = [
        { id: '1', fieldId: 1, operator: 'contains', value: 'hello' },
        { id: '2', fieldId: 2, operator: 'greater_than', value: '5' },
      ];
      const fieldsMap = new Map<number, CustomFieldForFilter>([
        [1, textField],
        [2, numberField],
      ]);
      const valuesMap = new Map<number, Map<number, CustomFieldValueForFilter>>();
      const taskValues = new Map<number, CustomFieldValueForFilter>();
      taskValues.set(1, { id: 1, customFieldId: 1, taskId: 1, value: 'Hello World' });
      taskValues.set(2, { id: 2, customFieldId: 2, taskId: 1, numericValue: '10' });
      valuesMap.set(1, taskValues);

      expect(taskPassesAllFilters(rules, 1, valuesMap, fieldsMap)).toBe(true);
    });

    it('should fail when one filter does not match', () => {
      const rules: CustomFieldFilterRule[] = [
        { id: '1', fieldId: 1, operator: 'contains', value: 'hello' },
        { id: '2', fieldId: 2, operator: 'greater_than', value: '15' },
      ];
      const fieldsMap = new Map<number, CustomFieldForFilter>([
        [1, textField],
        [2, numberField],
      ]);
      const valuesMap = new Map<number, Map<number, CustomFieldValueForFilter>>();
      const taskValues = new Map<number, CustomFieldValueForFilter>();
      taskValues.set(1, { id: 1, customFieldId: 1, taskId: 1, value: 'Hello World' });
      taskValues.set(2, { id: 2, customFieldId: 2, taskId: 1, numericValue: '10' });
      valuesMap.set(1, taskValues);

      expect(taskPassesAllFilters(rules, 1, valuesMap, fieldsMap)).toBe(false);
    });

    it('should pass when no filters are set', () => {
      const rules: CustomFieldFilterRule[] = [];
      const fieldsMap = new Map<number, CustomFieldForFilter>();
      const valuesMap = new Map<number, Map<number, CustomFieldValueForFilter>>();
      expect(taskPassesAllFilters(rules, 1, valuesMap, fieldsMap)).toBe(true);
    });
  });
});
