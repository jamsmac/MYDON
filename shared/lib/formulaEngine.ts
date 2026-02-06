/**
 * Formula Engine - Evaluates formulas with field references and functions
 * 
 * Supports:
 * - Field references: {field_name}, {status}, {priority}, {deadline}, {progress}
 * - Functions: SUM(), AVG(), COUNT(), MIN(), MAX(), IF(), CONCAT(), NOW(), DAYS_BETWEEN()
 * - Arithmetic: +, -, *, /, %
 * - Comparisons: ==, !=, <, >, <=, >=
 * - Logical: AND, OR, NOT
 * 
 * Error codes:
 * - #ERROR! - General error
 * - #REF! - Invalid field reference
 * - #DIV/0! - Division by zero
 * - #VALUE! - Invalid value type
 * - #NAME! - Unknown function
 */

export interface FormulaContext {
  // Task properties
  status?: string | null;
  priority?: string | null;
  deadline?: number | null;
  progress?: number | null;
  title?: string;
  description?: string | null;
  
  // Custom field values (field name -> value)
  fields: Record<string, string | number | boolean | null>;
  
  // For rollup calculations - array of related task values
  relatedValues?: (string | number | boolean | null)[];
}

export type FormulaResult = {
  success: true;
  value: string | number | boolean | null;
  type: 'string' | 'number' | 'boolean' | 'null';
} | {
  success: false;
  error: string;
  errorCode: '#ERROR!' | '#REF!' | '#DIV/0!' | '#VALUE!' | '#NAME!';
};

// Token types for lexer
type TokenType = 
  | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'NULL'
  | 'FIELD_REF' | 'FUNCTION' | 'OPERATOR' | 'COMPARISON'
  | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';

interface Token {
  type: TokenType;
  value: string | number | boolean | null;
  raw: string;
}

// Supported functions
const FUNCTIONS: Record<string, (...args: any[]) => any> = {
  // Aggregation functions
  SUM: (...args: (number | null)[]) => {
    const nums = args.flat().filter((n): n is number => typeof n === 'number');
    return nums.reduce((a, b) => a + b, 0);
  },
  
  AVG: (...args: (number | null)[]) => {
    const nums = args.flat().filter((n): n is number => typeof n === 'number');
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },
  
  COUNT: (...args: any[]) => {
    return args.flat().filter(v => v !== null && v !== undefined).length;
  },
  
  MIN: (...args: (number | null)[]) => {
    const nums = args.flat().filter((n): n is number => typeof n === 'number');
    if (nums.length === 0) return null;
    return Math.min(...nums);
  },
  
  MAX: (...args: (number | null)[]) => {
    const nums = args.flat().filter((n): n is number => typeof n === 'number');
    if (nums.length === 0) return null;
    return Math.max(...nums);
  },
  
  // Conditional
  IF: (condition: boolean, trueValue: any, falseValue: any) => {
    return condition ? trueValue : falseValue;
  },
  
  // String functions
  CONCAT: (...args: any[]) => {
    return args.flat().map(v => String(v ?? '')).join('');
  },
  
  UPPER: (str: string) => String(str ?? '').toUpperCase(),
  LOWER: (str: string) => String(str ?? '').toLowerCase(),
  TRIM: (str: string) => String(str ?? '').trim(),
  LEN: (str: string) => String(str ?? '').length,
  LEFT: (str: string, n: number) => String(str ?? '').slice(0, n),
  RIGHT: (str: string, n: number) => String(str ?? '').slice(-n),
  
  // Date functions
  NOW: () => Date.now(),
  TODAY: () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  },
  
  DAYS_BETWEEN: (date1: number | null, date2: number | null) => {
    if (date1 === null || date2 === null) return null;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
  
  DATE_ADD: (date: number | null, days: number) => {
    if (date === null) return null;
    return date + days * 24 * 60 * 60 * 1000;
  },
  
  // Math functions
  ROUND: (num: number, decimals: number = 0) => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },
  
  FLOOR: (num: number) => Math.floor(num),
  CEIL: (num: number) => Math.ceil(num),
  ABS: (num: number) => Math.abs(num),
  
  // Logical functions
  AND: (...args: boolean[]) => args.every(Boolean),
  OR: (...args: boolean[]) => args.some(Boolean),
  NOT: (val: boolean) => !val,
  
  // Null handling
  ISNULL: (val: any) => val === null || val === undefined,
  IFNULL: (val: any, defaultVal: any) => val ?? defaultVal,
  
  // Type conversion
  NUMBER: (val: any) => {
    const num = Number(val);
    return isNaN(num) ? null : num;
  },
  TEXT: (val: any) => String(val ?? ''),
};

/**
 * Tokenize formula string
 */
function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  
  while (pos < formula.length) {
    const char = formula[pos];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      pos++;
      continue;
    }
    
    // Field reference: {field_name}
    if (char === '{') {
      const start = pos;
      pos++;
      let fieldName = '';
      while (pos < formula.length && formula[pos] !== '}') {
        fieldName += formula[pos];
        pos++;
      }
      if (formula[pos] === '}') pos++;
      tokens.push({ type: 'FIELD_REF', value: fieldName.trim(), raw: formula.slice(start, pos) });
      continue;
    }
    
    // String literal: "..." or '...'
    if (char === '"' || char === "'") {
      const quote = char;
      const start = pos;
      pos++;
      let str = '';
      while (pos < formula.length && formula[pos] !== quote) {
        if (formula[pos] === '\\' && pos + 1 < formula.length) {
          pos++;
          str += formula[pos];
        } else {
          str += formula[pos];
        }
        pos++;
      }
      if (formula[pos] === quote) pos++;
      tokens.push({ type: 'STRING', value: str, raw: formula.slice(start, pos) });
      continue;
    }
    
    // Number
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(formula[pos + 1] || ''))) {
      const start = pos;
      if (char === '-') pos++;
      while (pos < formula.length && /[0-9.]/.test(formula[pos])) {
        pos++;
      }
      const numStr = formula.slice(start, pos);
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr), raw: numStr });
      continue;
    }
    
    // Function or keyword
    if (/[a-zA-Z_]/.test(char)) {
      const start = pos;
      while (pos < formula.length && /[a-zA-Z0-9_]/.test(formula[pos])) {
        pos++;
      }
      const word = formula.slice(start, pos).toUpperCase();
      
      if (word === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true, raw: word });
      } else if (word === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false, raw: word });
      } else if (word === 'NULL') {
        tokens.push({ type: 'NULL', value: null, raw: word });
      } else if (word === 'AND' || word === 'OR' || word === 'NOT') {
        tokens.push({ type: 'OPERATOR', value: word, raw: word });
      } else {
        tokens.push({ type: 'FUNCTION', value: word, raw: word });
      }
      continue;
    }
    
    // Comparison operators
    if (char === '=' && formula[pos + 1] === '=') {
      tokens.push({ type: 'COMPARISON', value: '==', raw: '==' });
      pos += 2;
      continue;
    }
    if (char === '!' && formula[pos + 1] === '=') {
      tokens.push({ type: 'COMPARISON', value: '!=', raw: '!=' });
      pos += 2;
      continue;
    }
    if (char === '<' && formula[pos + 1] === '=') {
      tokens.push({ type: 'COMPARISON', value: '<=', raw: '<=' });
      pos += 2;
      continue;
    }
    if (char === '>' && formula[pos + 1] === '=') {
      tokens.push({ type: 'COMPARISON', value: '>=', raw: '>=' });
      pos += 2;
      continue;
    }
    if (char === '<' || char === '>') {
      tokens.push({ type: 'COMPARISON', value: char, raw: char });
      pos++;
      continue;
    }
    
    // Arithmetic operators
    if (['+', '-', '*', '/', '%'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char, raw: char });
      pos++;
      continue;
    }
    
    // Parentheses and comma
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', raw: '(' });
      pos++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', raw: ')' });
      pos++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',', raw: ',' });
      pos++;
      continue;
    }
    
    // Unknown character - skip
    pos++;
  }
  
  tokens.push({ type: 'EOF', value: null, raw: '' });
  return tokens;
}

/**
 * Simple recursive descent parser and evaluator
 */
class FormulaEvaluator {
  private tokens: Token[];
  private pos: number = 0;
  private context: FormulaContext;
  
  constructor(tokens: Token[], context: FormulaContext) {
    this.tokens = tokens;
    this.context = context;
  }
  
  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: null, raw: '' };
  }
  
  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }
  
  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return this.advance();
  }
  
  evaluate(): any {
    return this.parseExpression();
  }
  
  private parseExpression(): any {
    return this.parseOr();
  }
  
  private parseOr(): any {
    let left = this.parseAnd();
    
    while (this.current().type === 'OPERATOR' && this.current().value === 'OR') {
      this.advance();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    
    return left;
  }
  
  private parseAnd(): any {
    let left = this.parseComparison();
    
    while (this.current().type === 'OPERATOR' && this.current().value === 'AND') {
      this.advance();
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    
    return left;
  }
  
  private parseComparison(): any {
    let left = this.parseAddSub();
    
    while (this.current().type === 'COMPARISON') {
      const op = this.advance().value as string;
      const right = this.parseAddSub();
      
      switch (op) {
        case '==': left = left == right; break;
        case '!=': left = left != right; break;
        case '<': left = left < right; break;
        case '>': left = left > right; break;
        case '<=': left = left <= right; break;
        case '>=': left = left >= right; break;
      }
    }
    
    return left;
  }
  
  private parseAddSub(): any {
    let left = this.parseMulDiv();
    
    while (this.current().type === 'OPERATOR' && ['+', '-'].includes(this.current().value as string)) {
      const op = this.advance().value as string;
      const right = this.parseMulDiv();
      
      if (op === '+') {
        // String concatenation if either is string
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left ?? '') + String(right ?? '');
        } else {
          left = (Number(left) || 0) + (Number(right) || 0);
        }
      } else {
        left = (Number(left) || 0) - (Number(right) || 0);
      }
    }
    
    return left;
  }
  
  private parseMulDiv(): any {
    let left = this.parseUnary();
    
    while (this.current().type === 'OPERATOR' && ['*', '/', '%'].includes(this.current().value as string)) {
      const op = this.advance().value as string;
      const right = this.parseUnary();
      
      const leftNum = Number(left) || 0;
      const rightNum = Number(right) || 0;
      
      switch (op) {
        case '*': left = leftNum * rightNum; break;
        case '/': 
          if (rightNum === 0) throw new Error('#DIV/0!');
          left = leftNum / rightNum; 
          break;
        case '%': 
          if (rightNum === 0) throw new Error('#DIV/0!');
          left = leftNum % rightNum; 
          break;
      }
    }
    
    return left;
  }
  
  private parseUnary(): any {
    if (this.current().type === 'OPERATOR') {
      if (this.current().value === '-') {
        this.advance();
        return -Number(this.parseUnary());
      }
      if (this.current().value === 'NOT') {
        this.advance();
        return !Boolean(this.parseUnary());
      }
    }
    
    return this.parsePrimary();
  }
  
  private parsePrimary(): any {
    const token = this.current();
    
    switch (token.type) {
      case 'NUMBER':
      case 'STRING':
      case 'BOOLEAN':
      case 'NULL':
        this.advance();
        return token.value;
        
      case 'FIELD_REF':
        this.advance();
        return this.resolveFieldRef(token.value as string);
        
      case 'FUNCTION':
        return this.parseFunction();
        
      case 'LPAREN':
        this.advance();
        const expr = this.parseExpression();
        this.expect('RPAREN');
        return expr;
        
      default:
        throw new Error(`Unexpected token: ${token.type}`);
    }
  }
  
  private parseFunction(): any {
    const funcName = this.advance().value as string;
    
    if (!FUNCTIONS[funcName]) {
      throw new Error(`#NAME! Unknown function: ${funcName}`);
    }
    
    this.expect('LPAREN');
    
    const args: any[] = [];
    if (this.current().type !== 'RPAREN') {
      args.push(this.parseExpression());
      
      while (this.current().type === 'COMMA') {
        this.advance();
        args.push(this.parseExpression());
      }
    }
    
    this.expect('RPAREN');
    
    return FUNCTIONS[funcName](...args);
  }
  
  private resolveFieldRef(fieldName: string): any {
    // Built-in task properties
    const builtIn: Record<string, any> = {
      status: this.context.status,
      priority: this.context.priority,
      deadline: this.context.deadline,
      progress: this.context.progress,
      title: this.context.title,
      description: this.context.description,
    };
    
    if (fieldName in builtIn) {
      return builtIn[fieldName];
    }
    
    // Custom fields
    if (fieldName in this.context.fields) {
      return this.context.fields[fieldName];
    }
    
    // Related values for rollup
    if (fieldName === '_related' && this.context.relatedValues) {
      return this.context.relatedValues;
    }
    
    throw new Error(`#REF! Unknown field: ${fieldName}`);
  }
}

/**
 * Main entry point - evaluate a formula with given context
 */
export function evaluateFormula(formula: string, context: FormulaContext): FormulaResult {
  try {
    if (!formula || formula.trim() === '') {
      return { success: true, value: null, type: 'null' };
    }
    
    const tokens = tokenize(formula);
    const evaluator = new FormulaEvaluator(tokens, context);
    const result = evaluator.evaluate();
    
    // Determine result type
    let type: 'string' | 'number' | 'boolean' | 'null';
    if (result === null || result === undefined) {
      type = 'null';
    } else if (typeof result === 'boolean') {
      type = 'boolean';
    } else if (typeof result === 'number') {
      type = 'number';
    } else {
      type = 'string';
    }
    
    return { success: true, value: result, type };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Determine error code
    let errorCode: '#ERROR!' | '#REF!' | '#DIV/0!' | '#VALUE!' | '#NAME!' = '#ERROR!';
    if (message.startsWith('#REF!')) errorCode = '#REF!';
    else if (message.startsWith('#DIV/0!')) errorCode = '#DIV/0!';
    else if (message.startsWith('#VALUE!')) errorCode = '#VALUE!';
    else if (message.startsWith('#NAME!')) errorCode = '#NAME!';
    
    return { success: false, error: message, errorCode };
  }
}

/**
 * Evaluate a rollup formula (aggregation over related tasks)
 */
export function evaluateRollup(
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'concat',
  values: (string | number | boolean | null)[]
): FormulaResult {
  try {
    let result: any;
    
    switch (aggregation) {
      case 'sum':
        result = FUNCTIONS.SUM(values);
        break;
      case 'avg':
        result = FUNCTIONS.AVG(values);
        break;
      case 'count':
        result = FUNCTIONS.COUNT(values);
        break;
      case 'min':
        result = FUNCTIONS.MIN(values);
        break;
      case 'max':
        result = FUNCTIONS.MAX(values);
        break;
      case 'concat':
        result = FUNCTIONS.CONCAT(values);
        break;
      default:
        throw new Error(`#NAME! Unknown aggregation: ${aggregation}`);
    }
    
    const type = typeof result === 'number' ? 'number' : 
                 typeof result === 'string' ? 'string' : 
                 result === null ? 'null' : 'string';
    
    return { success: true, value: result, type };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message, errorCode: '#ERROR!' };
  }
}

/**
 * Validate a formula without evaluating it
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  try {
    if (!formula || formula.trim() === '') {
      return { valid: true };
    }
    
    // Try to tokenize
    const tokens = tokenize(formula);
    
    // Check for unknown functions
    for (const token of tokens) {
      if (token.type === 'FUNCTION' && !FUNCTIONS[token.value as string]) {
        return { valid: false, error: `Unknown function: ${token.value}` };
      }
    }
    
    // Try to parse with empty context (will fail on field refs but that's ok)
    try {
      const evaluator = new FormulaEvaluator(tokens, { fields: {} });
      evaluator.evaluate();
    } catch (e) {
      // Ignore field reference errors during validation
      const msg = e instanceof Error ? e.message : '';
      if (!msg.startsWith('#REF!')) {
        return { valid: false, error: msg };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid formula' };
  }
}

/**
 * Extract field references from a formula
 */
export function extractFieldRefs(formula: string): string[] {
  const refs: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  
  while ((match = regex.exec(formula)) !== null) {
    refs.push(match[1].trim());
  }
  
  return Array.from(new Set(refs));
}

/**
 * Get list of available functions with descriptions
 */
export function getAvailableFunctions(): { name: string; description: string; syntax: string }[] {
  return [
    { name: 'SUM', description: 'Сумма чисел', syntax: 'SUM(n1, n2, ...)' },
    { name: 'AVG', description: 'Среднее значение', syntax: 'AVG(n1, n2, ...)' },
    { name: 'COUNT', description: 'Количество непустых значений', syntax: 'COUNT(v1, v2, ...)' },
    { name: 'MIN', description: 'Минимальное значение', syntax: 'MIN(n1, n2, ...)' },
    { name: 'MAX', description: 'Максимальное значение', syntax: 'MAX(n1, n2, ...)' },
    { name: 'IF', description: 'Условие', syntax: 'IF(условие, значение_если_да, значение_если_нет)' },
    { name: 'CONCAT', description: 'Объединение строк', syntax: 'CONCAT(s1, s2, ...)' },
    { name: 'NOW', description: 'Текущее время (timestamp)', syntax: 'NOW()' },
    { name: 'TODAY', description: 'Начало сегодняшнего дня', syntax: 'TODAY()' },
    { name: 'DAYS_BETWEEN', description: 'Дней между датами', syntax: 'DAYS_BETWEEN(дата1, дата2)' },
    { name: 'ROUND', description: 'Округление', syntax: 'ROUND(число, знаков)' },
    { name: 'UPPER', description: 'В верхний регистр', syntax: 'UPPER(текст)' },
    { name: 'LOWER', description: 'В нижний регистр', syntax: 'LOWER(текст)' },
    { name: 'LEN', description: 'Длина строки', syntax: 'LEN(текст)' },
    { name: 'ISNULL', description: 'Проверка на пустоту', syntax: 'ISNULL(значение)' },
    { name: 'IFNULL', description: 'Значение по умолчанию', syntax: 'IFNULL(значение, по_умолчанию)' },
  ];
}
