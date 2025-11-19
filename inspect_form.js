const { readFileSync } = require('node:fs');
const { PDFDocument } = require('pdf-lib');

const DEFAULT_INPUT = 'austria.pdf';

function printHelp() {
  console.log(`List all form fields in a PDF.

Usage:
  node inspect_form.js [options]

Options:
  -i, --input <path>   PDF to inspect (default: ${DEFAULT_INPUT})
  -h, --help           Show this message

Positional usage:
  node inspect_form.js path/to/file.pdf
`);
}

function parseArgs(argv) {
  const options = { inputPath: DEFAULT_INPUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '-i':
      case '--input':
        options.inputPath = argv[++i];
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!options.inputPath || options.inputPath === DEFAULT_INPUT) {
          options.inputPath = arg;
        } else {
          console.error(`Unknown argument: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }
  return options;
}

async function main() {
  const { inputPath } = parseArgs(process.argv.slice(2));
  const pdfBytes = readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  const fields = form.getFields();
  console.log(`Inspecting "${inputPath}" -> Found ${fields.length} fields`);
  for (const field of fields) {
    const type = field.constructor.name;
    const suffix =
      type === 'PDFRadioGroup'
        ? ` options=${JSON.stringify(field.getOptions())}`
        : '';
    console.log(`- ${field.getName()} (${type})${suffix}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

