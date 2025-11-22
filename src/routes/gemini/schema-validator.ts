/**
 * Validates JSON schemas for OpenAI strict mode compliance.
 *
 * OpenAI's strict mode requirements:
 * 1. All object types must have `additionalProperties: false`
 * 2. All object types must have a `properties` field (can be empty)
 * 3. All array types must have an `items` definition
 * 4. No `nullable`, use union with null instead
 * 5. `required` fields must all exist in `properties`
 * 6. No undefined or null values in the schema
 * 7. All `$ref` must be resolved (no external references)
 */

export interface ValidationError {
  path: string
  message: string
  schema?: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: Array<ValidationError>
}

/**
 * Validates a JSON schema for OpenAI strict mode compliance.
 */
export function validateSchemaForStrictMode(
  schema: unknown,
  path: string = "root",
): ValidationResult {
  const errors: Array<ValidationError> = []

  // Check for null or undefined at the top level
  if (schema === null || schema === undefined) {
    errors.push({
      path,
      message: "Schema cannot be null or undefined",
      schema,
    })
    return { valid: false, errors }
  }

  if (typeof schema !== "object") {
    errors.push({
      path,
      message: "Schema must be an object",
      schema,
    })
    return { valid: false, errors }
  }

  const schemaObj = schema as Record<string, unknown>

  // Check for null or undefined values
  for (const [key, value] of Object.entries(schemaObj)) {
    if (value === null || value === undefined) {
      errors.push({
        path: `${path}.${key}`,
        message: `Field "${key}" has null or undefined value, which is not allowed in strict mode`,
        schema: schemaObj,
      })
    }
  }

  // Check if it's an object type
  if (schemaObj.type === "object") {
    // Rule 1: Must have additionalProperties: false
    if (schemaObj.additionalProperties !== false) {
      errors.push({
        path,
        message:
          'Object type must have "additionalProperties: false" for strict mode',
        schema: schemaObj,
      })
    }

    // Rule 2: Must have properties field
    if (!("properties" in schemaObj)) {
      errors.push({
        path,
        message:
          'Object type must have a "properties" field (can be empty object)',
        schema: schemaObj,
      })
    } else {
      // Validate properties
      const properties = schemaObj.properties as Record<string, unknown>
      if (typeof properties === "object" && properties !== null) {
        for (const [propKey, propValue] of Object.entries(properties)) {
          const propResult = validateSchemaForStrictMode(
            propValue,
            `${path}.properties.${propKey}`,
          )
          errors.push(...propResult.errors)
        }
      }
    }

    // Rule 5: Required fields must exist in properties
    if (Array.isArray(schemaObj.required)) {
      const properties = schemaObj.properties as Record<string, unknown>
      for (const requiredField of schemaObj.required) {
        if (
          typeof requiredField === "string"
          && (!properties
            || typeof properties !== "object"
            || !(requiredField in properties))
        ) {
          errors.push({
            path,
            message: `Required field "${requiredField}" not found in properties`,
            schema: schemaObj,
          })
        }
      }
    }
  }

  // Rule 3: Array types must have items
  if (schemaObj.type === "array") {
    if (!("items" in schemaObj)) {
      errors.push({
        path,
        message: 'Array type must have an "items" definition for strict mode',
        schema: schemaObj,
      })
    } else {
      // Validate items schema
      const itemsResult = validateSchemaForStrictMode(
        schemaObj.items,
        `${path}.items`,
      )
      errors.push(...itemsResult.errors)
    }
  }

  // Rule 4: No nullable field
  if ("nullable" in schemaObj) {
    errors.push({
      path,
      message:
        'The "nullable" field is not supported in strict mode. Use union types with null instead.',
      schema: schemaObj,
    })
  }

  // Rule 7: No $ref (must be resolved)
  if ("$ref" in schemaObj) {
    errors.push({
      path,
      message:
        'The "$ref" field is not supported in strict mode. All references must be resolved.',
      schema: schemaObj,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validates all tools in an OpenAI request for strict mode compliance.
 */
export function validateToolsForStrictMode(
  tools: Array<{
    type: string
    function: {
      name: string
      description?: string
      parameters: unknown
      strict?: boolean
    }
  }>,
): ValidationResult {
  const errors: Array<ValidationError> = []

  for (const [i, tool] of tools.entries()) {
    if (tool.type !== "function") {
      errors.push({
        path: `tools[${i}].type`,
        message: `Tool type must be "function", got "${tool.type}"`,
        schema: tool,
      })
      continue
    }

    if (!tool.function.name) {
      errors.push({
        path: `tools[${i}].function.name`,
        message: "Tool function name is required",
        schema: tool,
      })
    }

    // If strict mode is enabled, validate the parameters schema
    if (tool.function.strict === true) {
      const schemaResult = validateSchemaForStrictMode(
        tool.function.parameters,
        `tools[${i}].function.parameters`,
      )
      errors.push(...schemaResult.errors)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Formats validation errors into a human-readable string.
 */
export function formatValidationErrors(errors: Array<ValidationError>): string {
  if (errors.length === 0) return "No validation errors"

  return errors
    .map((error, i) => {
      let msg = `${i + 1}. [${error.path}] ${error.message}`
      if (error.schema) {
        msg += `\n   Schema: ${JSON.stringify(error.schema).slice(0, 100)}...`
      }
      return msg
    })
    .join("\n\n")
}
