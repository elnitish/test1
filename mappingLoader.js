const path = require('node:path');
const { readFile } = require('node:fs/promises');

async function loadMappingConfig(formKey) {
  if (!formKey) {
    throw new Error('Form key is required to load mapping config.');
  }
  const filePath = path.join(__dirname, 'mappings', `${formKey}.json`);
  const mappingBytes = await readFile(filePath, 'utf8');
  return JSON.parse(mappingBytes);
}

function buildFieldValues(mappingConfig, context) {
  if (!mappingConfig || typeof mappingConfig !== 'object') {
    throw new Error('Mapping config must be an object.');
  }

  const output = {};
  for (const [fieldName, entry] of Object.entries(mappingConfig)) {
    const value = resolveEntry(entry, context);
    if (value !== undefined && value !== null) {
      output[fieldName] = value;
    }
  }
  return output;
}

function resolveEntry(entry, context) {
  if (entry === null || entry === undefined) {
    return entry;
  }

  if (typeof entry === 'string') {
    return getPathValue(context, entry);
  }

  if (typeof entry !== 'object') {
    return entry;
  }

  if (entry.value !== undefined) {
    return entry.value;
  }

  let value = null;

  if (entry.paths) {
    value = buildFromPaths(entry.paths, entry.join, context);
  } else if (entry.path) {
    value = getPathValue(context, entry.path);
  }

  if (entry.format) {
    value = formatValue(value, entry.format);
  }

  if (entry.prefix && value) {
    value = `${entry.prefix}${value}`;
  }

  if (entry.suffix && value) {
    value = `${value}${entry.suffix}`;
  }

  if (entry.trim !== false && typeof value === 'string') {
    value = value.trim();
  }

  switch (entry.type) {
    case 'checkbox':
      return resolveCheckbox(value, entry);
    case 'radio':
      return resolveRadio(value, entry);
    default:
      break;
  }

  if (entry.uppercase && typeof value === 'string') {
    value = value.toUpperCase();
  }

  if (entry.lowercase && typeof value === 'string') {
    value = value.toLowerCase();
  }

  if ((value === undefined || value === null || value === '') && entry.default !== undefined) {
    return entry.default;
  }

  return value;
}

function buildFromPaths(paths, joiner = '\n', context) {
  const values = paths
    .map((pathDef) => {
      if (typeof pathDef === 'string') {
        return getPathValue(context, pathDef);
      }
      if (pathDef && typeof pathDef === 'object' && pathDef.path) {
        let value = getPathValue(context, pathDef.path);
        if (pathDef.format) {
          value = formatValue(value, pathDef.format);
        }
        return value;
      }
      return null;
    })
    .filter((value) => value !== undefined && value !== null && value !== '');

  if (!values.length) {
    return null;
  }

  return joiner ? values.join(joiner) : values.join('');
}

function getPathValue(source, pathExpression) {
  if (!source || !pathExpression) {
    return undefined;
  }
  const segments = pathExpression.split('.');
  let current = source;
  for (const segment of segments) {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function resolveCheckbox(value, entry) {
  if (entry.equals !== undefined) {
    return value === entry.equals;
  }

  if (entry.truthyValues && value !== undefined && value !== null) {
    const compareValue = String(value).toLowerCase();
    return entry.truthyValues.map((v) => v.toLowerCase()).includes(compareValue);
  }

  return Boolean(value);
}

function resolveRadio(value, entry) {
  if (value === undefined || value === null) {
    return entry.default ?? null;
  }

  if (entry.caseInsensitive && typeof value === 'string') {
    const normalizedMap = Object.fromEntries(
      Object.entries(entry.map || {}).map(([key, v]) => [key.toLowerCase(), v]),
    );
    const lookupKey = value.toLowerCase();
    if (normalizedMap[lookupKey]) {
      return normalizedMap[lookupKey];
    }
  }

  if (entry.map && entry.map[value] !== undefined) {
    return entry.map[value];
  }

  return entry.default ?? value;
}

function formatValue(value, format) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  switch (format) {
    case 'DATE_DDMMYYYY':
      return formatDate(value, 'DD.MM.YYYY');
    case 'DATE_ISO':
      return formatDate(value, 'YYYY-MM-DD');
    default:
      return value;
  }
}

function formatDate(value, pattern) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const components = {
    DD: String(date.getDate()).padStart(2, '0'),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    YYYY: String(date.getFullYear()),
  };

  return pattern.replace(/DD|MM|YYYY/g, (match) => components[match]);
}

module.exports = {
  loadMappingConfig,
  buildFieldValues,
};

