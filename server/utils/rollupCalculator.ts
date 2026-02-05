/**
 * Rollup Calculator - Calculates aggregate values from related entities
 */

import { getDb } from '../db';
import * as schema from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { RelationResolver } from './relationResolver';

// EntityType for rollup fields (matches schema enum)
export type RollupEntityType = 'project' | 'block' | 'section' | 'task';

export type AggregationFunction = 
  | 'count' | 'count_values' | 'count_unique' | 'count_checked' | 'count_unchecked'
  | 'sum' | 'average' | 'median' | 'min' | 'max' | 'range'
  | 'percent_empty' | 'percent_not_empty' | 'percent_checked' | 'percent_unchecked'
  | 'earliest_date' | 'latest_date' | 'date_range_days'
  | 'show_original' | 'concatenate';

export interface RollupFieldConfig {
  entityType: RollupEntityType;
  entityId?: number;
  name: string;
  displayName: string;
  sourceRelationType: string;
  sourceProperty: string;
  aggregationFunction: AggregationFunction;
  filterConditions?: {
    field: string;
    operator: string;
    value: string | number | boolean | null;
  }[];
  displayFormat?: string;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  progressBarMax?: number;
  progressBarColor?: string;
}

export class RollupCalculator {
  /**
   * Create a rollup field definition
   */
  static async createRollupField(config: RollupFieldConfig, userId: number) {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const result = await db.insert(schema.rollupFields).values({
      entityType: config.entityType,
      entityId: config.entityId || null,
      name: config.name,
      displayName: config.displayName,
      sourceRelationType: config.sourceRelationType,
      sourceProperty: config.sourceProperty,
      aggregationFunction: config.aggregationFunction,
      filterConditions: config.filterConditions || null,
      displayFormat: (config.displayFormat as any) || 'number',
      decimalPlaces: config.decimalPlaces ?? 0,
      prefix: config.prefix || null,
      suffix: config.suffix || null,
      progressBarMax: config.progressBarMax || null,
      progressBarColor: config.progressBarColor || null,
      createdBy: userId,
    });

    return { id: (result as any)[0]?.insertId || result[0] };
  }

  /**
   * Calculate rollup value for an entity
   */
  static async calculateRollup(
    rollupFieldId: number,
    entityType: RollupEntityType,
    entityId: number
  ): Promise<{ value: unknown; formatted: string }> {
    const db = await getDb();
    if (!db) return { value: null, formatted: '' };

    // Get rollup field definition
    const rollupFields = await db
      .select()
      .from(schema.rollupFields)
      .where(eq(schema.rollupFields.id, rollupFieldId))
      .limit(1);

    if (rollupFields.length === 0) return { value: null, formatted: '' };
    const rollupField = rollupFields[0];

    // Get related entities
    const relatedEntities = await RelationResolver.getRelatedEntities(
      entityType as any,
      entityId,
      rollupField.sourceRelationType as any
    );

    // Extract property values
    let values: unknown[] = relatedEntities
      .map((re) => this.getPropertyValue(re.entity, rollupField.sourceProperty))
      .filter((v) => v !== null && v !== undefined);

    // Apply filter conditions if any
    if (rollupField.filterConditions && Array.isArray(rollupField.filterConditions)) {
      values = this.applyFilters(relatedEntities, rollupField.filterConditions as any[], rollupField.sourceProperty);
    }

    // Calculate aggregate
    const result = this.calculateAggregate(values, rollupField.aggregationFunction, relatedEntities);

    // Format result
    const formatted = this.formatResult(result, rollupField);

    // Update cache
    await this.updateCache(rollupFieldId, result, formatted);

    return { value: result, formatted };
  }

  /**
   * Get a property value from an entity
   */
  private static getPropertyValue(entity: any, property: string): unknown {
    if (!entity) return null;

    const parts = property.split('.');
    let value = entity;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = value[part];
    }

    return value;
  }

  /**
   * Apply filter conditions to related entities
   */
  private static applyFilters(
    entities: { entity: any }[],
    conditions: { field: string; operator: string; value: unknown }[],
    sourceProperty: string
  ): unknown[] {
    return entities
      .filter((e) => {
        return conditions.every((cond) => {
          const fieldValue = this.getPropertyValue(e.entity, cond.field);
          return this.evaluateCondition(fieldValue, cond.operator, cond.value);
        });
      })
      .map((e) => this.getPropertyValue(e.entity, sourceProperty));
  }

  /**
   * Evaluate a filter condition
   */
  private static evaluateCondition(fieldValue: unknown, operator: string, condValue: unknown): boolean {
    switch (operator) {
      case 'equals':
      case '=':
        return fieldValue === condValue;
      case 'not_equals':
      case '!=':
        return fieldValue !== condValue;
      case 'contains':
        return String(fieldValue).includes(String(condValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(condValue));
      case 'greater_than':
      case '>':
        return Number(fieldValue) > Number(condValue);
      case 'less_than':
      case '<':
        return Number(fieldValue) < Number(condValue);
      case 'greater_or_equal':
      case '>=':
        return Number(fieldValue) >= Number(condValue);
      case 'less_or_equal':
      case '<=':
        return Number(fieldValue) <= Number(condValue);
      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'is_checked':
        return fieldValue === true || fieldValue === 'completed' || fieldValue === 'done';
      case 'is_unchecked':
        return fieldValue === false || (fieldValue !== 'completed' && fieldValue !== 'done');
      default:
        return true;
    }
  }

  /**
   * Calculate aggregate value
   */
  private static calculateAggregate(
    values: unknown[],
    aggregation: AggregationFunction,
    entities: { entity: any }[]
  ): unknown {
    const numericValues = values.map(Number).filter((n) => !isNaN(n));
    const total = entities.length;

    switch (aggregation) {
      // Count functions
      case 'count':
        return total;
      case 'count_values':
        return values.filter((v) => v !== null && v !== undefined && v !== '').length;
      case 'count_unique':
        return new Set(values.map(String)).size;
      case 'count_checked':
        return values.filter((v) => v === true || v === 'completed' || v === 'done').length;
      case 'count_unchecked':
        return values.filter((v) => v === false || (v !== 'completed' && v !== 'done' && v !== true)).length;

      // Numeric functions
      case 'sum':
        return numericValues.reduce((a, b) => a + b, 0);
      case 'average':
        return numericValues.length > 0
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : 0;
      case 'median':
        if (numericValues.length === 0) return 0;
        const sorted = numericValues.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      case 'min':
        return numericValues.length > 0 ? Math.min(...numericValues) : 0;
      case 'max':
        return numericValues.length > 0 ? Math.max(...numericValues) : 0;
      case 'range':
        return numericValues.length > 0
          ? Math.max(...numericValues) - Math.min(...numericValues)
          : 0;

      // Percentage functions
      case 'percent_empty':
        const emptyCount = values.filter((v) => v === null || v === undefined || v === '').length;
        return total > 0 ? (emptyCount / total) * 100 : 0;
      case 'percent_not_empty':
        const notEmptyCount = values.filter((v) => v !== null && v !== undefined && v !== '').length;
        return total > 0 ? (notEmptyCount / total) * 100 : 0;
      case 'percent_checked':
        const checkedCount = values.filter((v) => v === true || v === 'completed' || v === 'done').length;
        return total > 0 ? (checkedCount / total) * 100 : 0;
      case 'percent_unchecked':
        const uncheckedCount = values.filter((v) => v === false || (v !== 'completed' && v !== 'done' && v !== true)).length;
        return total > 0 ? (uncheckedCount / total) * 100 : 0;

      // Date functions
      case 'earliest_date':
        const dates = values.filter((v) => v instanceof Date || !isNaN(Date.parse(String(v))));
        if (dates.length === 0) return null;
        return new Date(Math.min(...dates.map((d) => new Date(d as any).getTime())));
      case 'latest_date':
        const lateDates = values.filter((v) => v instanceof Date || !isNaN(Date.parse(String(v))));
        if (lateDates.length === 0) return null;
        return new Date(Math.max(...lateDates.map((d) => new Date(d as any).getTime())));
      case 'date_range_days':
        const rangeDates = values.filter((v) => v instanceof Date || !isNaN(Date.parse(String(v))));
        if (rangeDates.length < 2) return 0;
        const timestamps = rangeDates.map((d) => new Date(d as any).getTime());
        const diffMs = Math.max(...timestamps) - Math.min(...timestamps);
        return Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Text functions
      case 'show_original':
        return values;
      case 'concatenate':
        return values.map(String).join(', ');

      default:
        return values.length;
    }
  }

  /**
   * Format the result based on display format
   */
  private static formatResult(value: unknown, rollupField: schema.RollupField): string {
    if (value === null || value === undefined) return '';

    const format = rollupField.displayFormat || 'number';
    const decimals = rollupField.decimalPlaces ?? 0;
    const prefix = rollupField.prefix || '';
    const suffix = rollupField.suffix || '';

    switch (format) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return `${prefix}${num.toFixed(decimals)}${suffix}`;

      case 'percentage':
        const pct = Number(value);
        if (isNaN(pct)) return String(value);
        return `${pct.toFixed(decimals)}%`;

      case 'currency':
        const amount = Number(value);
        if (isNaN(amount)) return String(value);
        return `${prefix || '$'}${amount.toFixed(2)}`;

      case 'duration':
        const hours = Number(value);
        if (isNaN(hours)) return String(value);
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;

      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);

      case 'progress_bar':
        const progress = Number(value);
        const max = rollupField.progressBarMax || 100;
        return `${Math.round((progress / max) * 100)}%`;

      case 'fraction':
        return String(value);

      case 'text':
      default:
        return String(value);
    }
  }

  /**
   * Update the cache for a rollup field
   */
  private static async updateCache(rollupFieldId: number, value: unknown, formatted: string) {
    const db = await getDb();
    if (!db) return;

    const cacheExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db
      .update(schema.rollupFields)
      .set({
        cachedValue: JSON.stringify({ value, formatted }),
        lastCalculatedAt: new Date(),
        cacheExpiresAt: cacheExpiry,
      })
      .where(eq(schema.rollupFields.id, rollupFieldId));
  }

  /**
   * Get cached rollup value if still valid
   */
  static async getCachedValue(rollupFieldId: number): Promise<{ value: unknown; formatted: string } | null> {
    const db = await getDb();
    if (!db) return null;

    const fields = await db
      .select()
      .from(schema.rollupFields)
      .where(eq(schema.rollupFields.id, rollupFieldId))
      .limit(1);

    if (fields.length === 0) return null;
    const field = fields[0];

    if (!field.cachedValue || !field.cacheExpiresAt) return null;
    if (new Date(field.cacheExpiresAt) < new Date()) return null;

    try {
      return JSON.parse(field.cachedValue);
    } catch {
      return null;
    }
  }

  /**
   * Get all rollup fields for an entity type
   */
  static async getRollupFields(entityType: RollupEntityType, entityId?: number) {
    const db = await getDb();
    if (!db) return [];

    const results = await db
      .select()
      .from(schema.rollupFields)
      .where(eq(schema.rollupFields.isVisible, true));

    const filtered = results.filter((f) => f.entityType === entityType);

    if (entityId) {
      return filtered.filter((f) => f.entityId === null || f.entityId === entityId);
    }

    return filtered;
  }

  /**
   * Delete a rollup field
   */
  static async deleteRollupField(rollupFieldId: number) {
    const db = await getDb();
    if (!db) return false;

    await db
      .delete(schema.rollupFields)
      .where(eq(schema.rollupFields.id, rollupFieldId));

    return true;
  }
}
