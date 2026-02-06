/**
 * Tests for Custom Fields and Formula Engine
 */

import { describe, it, expect } from 'vitest';
import { 
  evaluateFormula, 
  evaluateRollup, 
  validateFormula, 
  extractFieldRefs,
  getAvailableFunctions,
  type FormulaContext 
} from '../shared/lib/formulaEngine';

describe('Formula Engine', () => {
  describe('Basic Arithmetic', () => {
    it('should evaluate simple addition', () => {
      const result = evaluateFormula('2 + 3', {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should evaluate multiplication', () => {
      const result = evaluateFormula('4 * 5', {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should evaluate division', () => {
      const result = evaluateFormula('10 / 2', {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should handle division by zero', () => {
      const result = evaluateFormula('10 / 0', {});
      expect(result.success).toBe(false);
      expect((result as any).errorCode).toBe('#DIV/0!');
    });

    it('should evaluate complex expressions', () => {
      const result = evaluateFormula('(2 + 3) * 4 - 10 / 2', {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(15);
    });
  });

  describe('Field References', () => {
    it('should substitute field values', () => {
      const context: FormulaContext = {
        fields: { budget: 1000, spent: 300 }
      };
      const result = evaluateFormula('{budget} - {spent}', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(700);
    });

    it('should access task properties', () => {
      const context: FormulaContext = {
        progress: 75
      };
      const result = evaluateFormula('{progress} * 2', context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(150);
    });

    it('should handle missing field references', () => {
      const result = evaluateFormula('{nonexistent}', {});
      expect(result.success).toBe(false);
      expect((result as any).errorCode).toBe('#ERROR!');
    });
  });

  describe('Built-in Functions', () => {
    describe('SUM', () => {
      it('should sum numbers', () => {
        const result = evaluateFormula('SUM(1, 2, 3, 4, 5)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(15);
      });

      it('should handle empty SUM', () => {
        const result = evaluateFormula('SUM()', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(0);
      });
    });

    describe('AVG', () => {
      it('should calculate average', () => {
        const result = evaluateFormula('AVG(10, 20, 30)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(20);
      });
    });

    describe('MIN/MAX', () => {
      it('should find minimum', () => {
        const result = evaluateFormula('MIN(5, 2, 8, 1)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(1);
      });

      it('should find maximum', () => {
        const result = evaluateFormula('MAX(5, 2, 8, 1)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(8);
      });
    });

    describe('COUNT', () => {
      it('should count values', () => {
        const result = evaluateFormula('COUNT(1, 2, 3)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(3);
      });
    });

    describe('IF', () => {
      it('should return true branch when condition is true', () => {
        const result = evaluateFormula('IF(1 > 0, 100, 0)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(100);
      });

      it('should return false branch when condition is false', () => {
        const result = evaluateFormula('IF(1 < 0, 100, 0)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should work with field references', () => {
        const context: FormulaContext = {
          priority: 'high',
          fields: { estimate: 10 }
        };
        const result = evaluateFormula('IF({priority} == "high", {estimate} * 1.5, {estimate})', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe(15);
      });
    });

    describe('ROUND/FLOOR/CEIL', () => {
      it('should round numbers', () => {
        const result = evaluateFormula('ROUND(3.7)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(4);
      });

      it('should floor numbers', () => {
        const result = evaluateFormula('FLOOR(3.7)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(3);
      });

      it('should ceil numbers', () => {
        const result = evaluateFormula('CEIL(3.2)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(4);
      });
    });

    describe('ABS', () => {
      it('should return absolute value', () => {
        const result = evaluateFormula('ABS(-5)', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(5);
      });
    });

    describe('CONCAT', () => {
      it('should concatenate strings', () => {
        const result = evaluateFormula('CONCAT("Hello", " ", "World")', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe('Hello World');
      });
    });

    describe('LEN', () => {
      it('should return string length', () => {
        const result = evaluateFormula('LEN("Hello")', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe(5);
      });
    });

    describe('UPPER/LOWER', () => {
      it('should convert to uppercase', () => {
        const result = evaluateFormula('UPPER("hello")', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe('HELLO');
      });

      it('should convert to lowercase', () => {
        const result = evaluateFormula('LOWER("HELLO")', {});
        expect(result.success).toBe(true);
        expect(result.value).toBe('hello');
      });
    });
  });

  describe('Nested Functions', () => {
    it('should handle nested function calls', () => {
      const result = evaluateFormula('SUM(1, MAX(2, 3), MIN(4, 5))', {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(8); // 1 + 3 + 4
    });

    it('should handle deeply nested expressions', () => {
      const result = evaluateFormula('IF(MAX(1, 2, 3) > 2, SUM(10, 20), 0)', {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });
  });

  describe('Formula Validation', () => {
    it('should validate correct formulas', () => {
      const result = validateFormula('SUM(1, 2, 3)');
      expect(result.valid).toBe(true);
    });

    it('should detect unbalanced parentheses', () => {
      const result = validateFormula('SUM(1, 2, 3');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('RPAREN');
    });

    it('should detect unbalanced braces', () => {
      const result = validateFormula('{field}');
      expect(result.valid).toBe(true); // Field refs are valid syntax
    });

    it('should detect unknown functions', () => {
      const result = validateFormula('UNKNOWN_FUNC(1)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown function');
    });
  });

  describe('Field Reference Extraction', () => {
    it('should extract field references', () => {
      const refs = extractFieldRefs('{budget} + {spent} - {refund}');
      expect(refs).toContain('budget');
      expect(refs).toContain('spent');
      expect(refs).toContain('refund');
      expect(refs.length).toBe(3);
    });

    it('should handle duplicate references', () => {
      const refs = extractFieldRefs('{budget} + {budget}');
      expect(refs.length).toBe(1);
      expect(refs[0]).toBe('budget');
    });
  });
});

describe('Rollup Evaluation', () => {
  describe('Numeric Aggregations', () => {
    it('should calculate sum', () => {
      const result = evaluateRollup('sum', [10, 20, 30]);
      expect(result.success).toBe(true);
      expect(result.value).toBe(60);
    });

    it('should calculate average', () => {
      const result = evaluateRollup('avg', [10, 20, 30]);
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should find minimum', () => {
      const result = evaluateRollup('min', [10, 5, 30]);
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should find maximum', () => {
      const result = evaluateRollup('max', [10, 5, 30]);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    it('should count values', () => {
      const result = evaluateRollup('count', [10, 20, 30, null, 50]);
      expect(result.success).toBe(true);
      expect(result.value).toBe(4); // null excluded
    });
  });

  describe('String Aggregations', () => {
    it('should concatenate strings', () => {
      const result = evaluateRollup('concat', ['a', 'b', 'c']);
      expect(result.success).toBe(true);
      expect(result.value).toBe('abc');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      const result = evaluateRollup('sum', []);
      expect(result.success).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should handle null values', () => {
      const result = evaluateRollup('sum', [10, null, 20, null]);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });
  });
});

describe('Available Functions', () => {
  it('should return list of available functions', () => {
    const functions = getAvailableFunctions();
    expect(functions.length).toBeGreaterThan(0);
    
    const functionNames = functions.map(f => f.name);
    expect(functionNames).toContain('SUM');
    expect(functionNames).toContain('AVG');
    expect(functionNames).toContain('IF');
    expect(functionNames).toContain('CONCAT');
  });

  it('should include syntax and description for each function', () => {
    const functions = getAvailableFunctions();
    for (const func of functions) {
      expect(func.name).toBeDefined();
      expect(func.syntax).toBeDefined();
      expect(func.description).toBeDefined();
    }
  });
});
