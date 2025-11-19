const { readFileSync } = require('node:fs');
const { PDFDocument, PDFRadioGroup } = require('pdf-lib');

async function main() {
  const pdfBytes = readFileSync('austria.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  for (const field of form.getFields()) {
    if (field instanceof PDFRadioGroup) {
      console.log(`Radio field: ${field.getName()}`);
      const widgets = field.acroField.getWidgets();
      widgets.forEach((widget, idx) => {
        const apState = widget.getAppearanceState
          ? widget.getAppearanceState()
          : '(no getter)';
        const value = widget.getOnValue ? widget.getOnValue() : null;
        console.log(`  widget ${idx}: onValue=${value} appearanceState=${apState}`);
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

