const path = require('node:path');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { PDFDocument } = require('pdf-lib');

const DEFAULT_PDF = 'austria.pdf';
const DEFAULT_DATA = path.join('data', 'form-data.json');

function printHelp() {
  console.log(`Generate placeholder field values for a PDF form.

Usage:
  node generate_dummy_data.js [options]

Options:
  -p, --pdf <path>     PDF to inspect (default: ${DEFAULT_PDF})
  -d, --data <path>    JSON file to write (default: ${DEFAULT_DATA})
  -h, --help           Show this message

Positional:
  node generate_dummy_data.js input.pdf output.json
`);
}

function parseArgs(argv) {
  const options = { pdfPath: DEFAULT_PDF, dataPath: DEFAULT_DATA };
  let positionalIndex = 0;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-p':
      case '--pdf':
        options.pdfPath = argv[++i];
        break;
      case '-d':
      case '--data':
        options.dataPath = argv[++i];
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
        if (positionalIndex === 0) {
          options.pdfPath = arg;
        } else if (positionalIndex === 1) {
          options.dataPath = arg;
        } else {
          console.error('Too many positional arguments.');
          printHelp();
          process.exit(1);
        }
        positionalIndex += 1;
    }
  }
  return options;
}

async function main() {
  const { pdfPath, dataPath } = parseArgs(process.argv.slice(2));
  const pdfBytes = readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  const existingData = existsSync(dataPath)
    ? JSON.parse(readFileSync(dataPath, 'utf8'))
    : {};

  let shortTextCounter = 1;
  let longTextCounter = 1;
  let checkboxToggle = true;

  const orderedData = {};

  for (const field of form.getFields()) {
    const name = field.getName();
    const prefilled = Object.prototype.hasOwnProperty.call(existingData, name)
      ? existingData[name]
      : undefined;

    if (prefilled !== undefined) {
      orderedData[name] = prefilled;
      continue;
    }

    const ctorName = field.constructor.name;
    let value = '';

    if (ctorName === 'PDFTextField') {
      if (name.startsWith('textarea_')) {
        value = `Multiline sample paragraph #${longTextCounter}\nSecond line for ${name}`;
        longTextCounter += 1;
      } else {
        value = `Sample value #${shortTextCounter} for ${name}`;
        shortTextCounter += 1;
      }
    } else if (ctorName === 'PDFRadioGroup') {
      const options = field.getOptions();
      value =
        options.find((opt) => opt && opt.toLowerCase() !== 'off') ??
        options[0] ??
        '';
    } else if (ctorName === 'PDFCheckBox') {
      value = checkboxToggle;
      checkboxToggle = !checkboxToggle;
    } else {
      value = '';
    }

    orderedData[name] = value;
  }

  writeFileSync(dataPath, JSON.stringify(orderedData, null, 2));
  console.log(`Dummy data for "${pdfPath}" written to ${dataPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

