const path = require('node:path');
const { existsSync } = require('node:fs');
const { readFile, writeFile } = require('node:fs/promises');
const { PDFDocument } = require('pdf-lib');

const DEFAULT_INPUT = 'austria.pdf';
const DEFAULT_OUTPUT = 'austria-filled.pdf';
const DEFAULT_DATA = path.join('data', 'form-data.json');

function parseArgs(argv) {
  const options = {
    inputPath: DEFAULT_INPUT,
    outputPath: DEFAULT_OUTPUT,
    dataPath: DEFAULT_DATA,
    flatten: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--input':
      case '-i':
        options.inputPath = argv[++i];
        break;
      case '--output':
      case '-o':
        options.outputPath = argv[++i];
        break;
      case '--data':
      case '-d':
        options.dataPath = argv[++i];
        break;
      case '--flatten':
        options.flatten = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Fill the Austria PDF form using pdf-lib.

Usage:
  node fill_austria_form.js [options]

Options:
  -i, --input <path>   Input PDF (default: ${DEFAULT_INPUT})
  -o, --output <path>  Output PDF (default: ${DEFAULT_OUTPUT})
  -d, --data <path>    JSON file with fieldName:value pairs (default: ${DEFAULT_DATA})
      --flatten        Flatten the form before saving
  -h, --help           Show this help message
`);
}

async function loadFormData(filePath) {
  if (!existsSync(filePath)) {
    console.warn(`Data file "${filePath}" not found. Continuing without field values.`);
    return {};
  }

  try {
    const file = await readFile(filePath, 'utf8');
    const data = JSON.parse(file);
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('JSON root must be an object with fieldName:value pairs');
    }
    return data;
  } catch (err) {
    console.error(`Failed to parse data JSON "${filePath}": ${err.message}`);
    process.exit(1);
  }
}

function coerceCheckboxValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === '' ||
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'off' ||
      normalized === 'no' ||
      normalized === 'unchecked'
    ) {
      return false;
    }
    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'on' ||
      normalized === 'yes' ||
      normalized === 'checked' ||
      normalized === 'x'
    ) {
      return true;
    }
  }
  return Boolean(value);
}

function applyValueToField(field, value) {
  const fieldType = field.constructor.name;
  switch (fieldType) {
    case 'PDFTextField':
      field.setText(value ?? '');
      break;
    case 'PDFDropdown':
      field.select(String(value ?? ''));
      break;
    case 'PDFRadioGroup': {
      if (typeof value !== 'string') {
        throw new Error('Radio values must be strings that match the option name.');
      }
      field.select(value);
      break;
    }
    case 'PDFCheckBox': {
      const shouldCheck = coerceCheckboxValue(value);
      if (shouldCheck) {
        field.check();
      } else {
        field.uncheck();
      }
      break;
    }
    default:
      throw new Error(`Field type ${fieldType} not supported.`);
  }
}

function tryGetField(form, name) {
  try {
    return form.getField(name);
  } catch (err) {
    return null;
  }
}

async function fillPdfForm({ inputPath, outputPath, data, flatten = false }) {
  if (!data || typeof data !== 'object') {
    throw new Error('The "data" option must be an object with fieldName:value entries.');
  }

  const pdfBytes = await readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  const updated = [];
  const missingFields = [];

  for (const [fieldName, value] of Object.entries(data)) {
    const field = tryGetField(form, fieldName);
    if (!field) {
      missingFields.push(fieldName);
      continue;
    }

    try {
      applyValueToField(field, value);
      updated.push(fieldName);
    } catch (err) {
      console.warn(`Skipped "${fieldName}": ${err.message}`);
    }
  }

  if (flatten) {
    form.flatten();
  }

  const filledPdfBytes = await pdfDoc.save();
  if (outputPath) {
    await writeFile(outputPath, filledPdfBytes);
  }

  return { updated, missingFields, buffer: filledPdfBytes };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const formData = await loadFormData(options.dataPath);

  const { updated, missingFields } = await fillPdfForm({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    data: formData,
    flatten: options.flatten,
  });

  console.log(`Filled PDF saved to "${options.outputPath}".`);
  if (updated.length) {
    console.log(`Updated fields (${updated.length}): ${updated.join(', ')}`);
  } else {
    console.log('No fields were updated. Check your data JSON.');
  }

  if (missingFields.length) {
    console.warn(`The following fields were not found in the form: ${missingFields.join(', ')}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = { fillPdfForm };
}

