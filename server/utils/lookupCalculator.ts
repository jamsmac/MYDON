/**
 * Lookup Calculator - Calculates lookup field values from related entities
 */

import { getDb } from '../db';
import * as schema from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { RelationResolver } from './relationResolver';

// EntityType for lookup fields (matches schema enum)
export type LookupEntityType = 'project' | 'block' | 'section' | 'task';

export interface LookupFieldConfig {
  entityType: LookupEntityType;
  entityId?: number;
  name: string;
  displayName: string;
  relationType: string;
  sourceProperty: string;
  displayFormat?: string;
  aggregation?: 'first' | 'last' | 'all' | 'count' | 'comma_list' | 'unique';
  formatOptions?: {
    dateFormat?: string;
    numberFormat?: string;
    prefix?: string;
    suffix?: string;
    maxItems?: number;
    emptyText?: string;
  };
}

export class LookupCalculator {
  /**
   * Create a lookup field definition
   */
  static async createLookupField(config: LookupFieldConfig, userId: number) {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const result = await db.insert(schema.lookupFields).values({
      entityType: config.entityType,
      entityId: config.entityId || null,
      name: config.name,
      displayName: config.displayName,
      relationType: config.relationType,
      sourceProperty: config.sourceProperty,
      displayFormat: (config.displayFormat as any) || 'text',
      aggregation: (config.aggregation as any) || 'first',
      formatOptions: config.formatOptions || null,
      createdBy: userId,
    });

    return { id: (result as any)[0]?.insertId || result[0] };
  }

  /**
   * Calculate lookup value for an entity
   */
  static async calculateLookup(
    lookupFieldId: number,
    entityType: LookupEntityType,
    entityId: number
  ): Promise<unknown> {
    const db = await getDb();
    if (!db) return null;

    // Get lookup field definition
    const lookupFields = await db
      .select()
      .from(schema.lookupFields)
      .where(eq(schema.lookupFields.id, lookupFieldId))
      .limit(1);

    if (lookupFields.length === 0) return null;
    const lookupField = lookupFields[0];

    // Get related entities
    const relatedEntities = await RelationResolver.getRelatedEntities(
      entityType,
      entityId,
      lookupField.relationType as any
    );

    if (relatedEntities.length === 0) {
      return lookupField.formatOptions?.emptyText || null;
    }

    // Extract property values from related entities
    const values = relatedEntities
      .map((re) => this.getPropertyValue(re.entity, lookupField.sourceProperty))
      .filter((v) => v !== null && v !== undefined);

    // Apply aggregation
    return this.applyAggregation(values, lookupField.aggregation || 'first', lookupField);
  }

  /**
   * Get a property value from an entity
   */
  private static getPropertyValue(entity: any, property: string): unknown {
    if (!entity) return null;

    // Handle nested properties (e.g., "assignee.name")
    const parts = property.split('.');
    let value = entity;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = value[part];
    }

    return value;
  }

  /**
   * Apply aggregation function to values
   */
  private static applyAggregation(
    values: unknown[],
    aggregation: string,
    lookupField: schema.LookupField
  ): unknown {
    if (values.length === 0) {
      return lookupField.formatOptions?.emptyText || null;
    }

    switch (aggregation) {
      case 'first':
        return this.formatValue(values[0], lookupField);

      case 'last':
        return this.formatValue(values[values.length - 1], lookupField);

      case 'all':
        return values.map((v) => this.formatValue(v, lookupField));

      case 'count':
        return values.length;

      case 'comma_list':
        const maxItems = lookupField.formatOptions?.maxItems || 10;
        const items = values.slice(0, maxItems).map((v) => this.formatValue(v, lookupField));
        const suffix = values.length > maxItems ? ` +${values.length - maxItems} more` : '';
        return items.join(', ') + suffix;

      case 'unique':
        const uniqueValues = Array.from(new Set(values.map(String)));
        return uniqueValues.map((v) => this.formatValue(v, lookupField));

      default:
        return this.formatValue(values[0], lookupField);
    }
  }

  /**
   * Format a value based on display format
   */
  private static formatValue(value: unknown, lookupField: schema.LookupField): unknown {
    if (value === null || value === undefined) {
      return lookupField.formatOptions?.emptyText || null;
    }

    const format = lookupField.displayFormat || 'text';
    const options = lookupField.formatOptions || {};

    switch (format) {
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return value;

      case 'datetime':
        if (value instanceof Date) {
          return value.toLocaleString();
        }
        return value;

      case 'number':
        const num = Number(value);
        if (isNaN(num)) return value;
        return `${options.prefix || ''}${num.toLocaleString()}${options.suffix || ''}`;

      case 'currency':
        const amount = Number(value);
        if (isNaN(amount)) return value;
        return `${options.prefix || '$'}${amount.toFixed(2)}`;

      case 'percentage':
        const pct = Number(value);
        if (isNaN(pct)) return value;
        return `${pct.toFixed(1)}%`;

      case 'progress_bar':
        const progress = Number(value);
        if (isNaN(progress)) return value;
        return { value: progress, type: 'progress_bar' };

      case 'badge':
        return { value, type: 'badge' };

      case 'link':
        return { value, type: 'link' };

      default:
        return String(value);
    }
  }

  /**
   * Get all lookup fields for an entity type
   */
  static async getLookupFields(entityType: LookupEntityType, entityId?: number) {
    const db = await getDb();
    if (!db) return [];

    // Get all visible lookup fields and filter in memory
    const results = await db
      .select()
      .from(schema.lookupFields)
      .where(eq(schema.lookupFields.isVisible, true));
    
    // Filter by entity type
    const filtered = results.filter(f => f.entityType === entityType);
    
    if (entityId) {
      // Get fields specific to this entity or templates (entityId = null)
      return filtered.filter(f => f.entityId === null || f.entityId === entityId);
    }

    return filtered;
  }

  /**
   * Delete a lookup field
   */
  static async deleteLookupField(lookupFieldId: number) {
    const db = await getDb();
    if (!db) return false;

    await db
      .delete(schema.lookupFields)
      .where(eq(schema.lookupFields.id, lookupFieldId));

    return true;
  }
}
